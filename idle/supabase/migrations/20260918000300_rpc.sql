-- "IDLE" — the API surface
--
-- Every mutation the app can perform is one of these functions. There are no
-- direct insert/update grants on the graph tables, so the rules below are the
-- only way an edge can ever come into existence.

-- ---------------------------------------------------------------------------
-- CODES
-- ---------------------------------------------------------------------------

-- Unambiguous alphabet: no 0/O, no 1/I/L. Codes get read aloud and retyped.
create or replace function public.gen_code(p_len int)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(p_len);
  v_out text := '';
  i int;
begin
  for i in 0 .. p_len - 1 loop
    v_out := v_out || substr(alphabet, 1 + (get_byte(v_bytes, i) % 31), 1);
  end loop;
  return v_out;
end;
$$;

create or replace function public.normalize_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- ONBOARDING
-- ---------------------------------------------------------------------------

create or replace function public.claim_handle(
  p_handle text,
  p_display_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_exists' using errcode = '23505';
  end if;

  insert into public.profiles (id, handle, display_name)
  values (
    v_uid,
    lower(btrim(p_handle)),
    nullif(btrim(coalesce(p_display_name, '')), '')
  )
  returning * into v_profile;

  loop
    v_code := public.gen_code(8);
    exit when not exists (select 1 from public.invite_codes c where c.code = v_code);
  end loop;
  insert into public.invite_codes (code, user_id) values (v_code, v_uid);

  insert into public.presence (user_id) values (v_uid);
  insert into public.user_settings (user_id) values (v_uid);

  return v_profile;
end;
$$;

create or replace function public.rotate_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  loop
    v_code := public.gen_code(8);
    exit when not exists (select 1 from public.invite_codes c where c.code = v_code);
  end loop;

  update public.invite_codes
     set code = v_code, rotated_at = now()
   where user_id = v_uid;

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- PAIRING A TERMINAL
-- ---------------------------------------------------------------------------

create or replace function public.create_pairing_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if (
    select count(*) from public.pairing_codes pc
    where pc.user_id = v_uid and pc.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  -- One live code at a time: asking for a new one burns the old.
  update public.pairing_codes pc
     set expires_at = now()
   where pc.user_id = v_uid and pc.consumed_at is null and pc.expires_at > now();

  loop
    v_code := public.gen_code(6);
    exit when not exists (select 1 from public.pairing_codes pc where pc.code = v_code);
  end loop;

  insert into public.pairing_codes (code, user_id, expires_at)
  values (v_code, v_uid, v_expires);

  return query select v_code, v_expires;
end;
$$;

-- ---------------------------------------------------------------------------
-- FINDING A PERSON
-- ---------------------------------------------------------------------------

create or replace function public.relationship_to(p_other uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return 'none'; end if;
  if v_uid = p_other then return 'self'; end if;
  if public.blocked_either_way(v_uid, p_other) then return 'blocked'; end if;
  if public.are_friends(v_uid, p_other) then return 'friend'; end if;

  if exists (
    select 1 from public.friend_requests r
    where r.status = 'pending' and r.sender_id = v_uid and r.recipient_id = p_other
  ) then return 'request_sent'; end if;

  if exists (
    select 1 from public.friend_requests r
    where r.status = 'pending' and r.sender_id = p_other and r.recipient_id = v_uid
  ) then return 'request_received'; end if;

  return 'none';
end;
$$;

-- Resolve someone's invite code (from a link, a typed code or a QR scan) into a
-- preview. Returns nothing for an unknown code AND for a block, so the caller
-- cannot tell the two apart.
create or replace function public.lookup_invite(p_code text)
returns table (
  user_id      uuid,
  handle       text,
  display_name text,
  avatar_url   text,
  relationship text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select c.user_id into v_target
  from public.invite_codes c
  where c.code = public.normalize_code(p_code);

  if v_target is null or public.blocked_either_way(v_uid, v_target) then
    return;
  end if;

  return query
  select p.id,
         p.handle::text,
         p.display_name,
         p.avatar_url,
         public.relationship_to(p.id)
  from public.profiles p
  where p.id = v_target;
end;
$$;

-- ---------------------------------------------------------------------------
-- REQUESTS
-- ---------------------------------------------------------------------------

create or replace function public.send_friend_request(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_incoming uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_uid = p_user_id then
    raise exception 'cannot_friend_self' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'no_such_person' using errcode = '02000';
  end if;
  if public.blocked_either_way(v_uid, p_user_id) then
    -- Say nothing useful. A blocked account must not learn it was blocked.
    raise exception 'no_such_person' using errcode = '02000';
  end if;
  if public.are_friends(v_uid, p_user_id) then
    return 'friend';
  end if;

  if (
    select count(*) from public.friend_requests r
    where r.sender_id = v_uid and r.created_at > now() - interval '1 day'
  ) >= 50 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  -- They already asked you: asking back is accepting.
  select r.id into v_incoming
  from public.friend_requests r
  where r.status = 'pending' and r.sender_id = p_user_id and r.recipient_id = v_uid;

  if v_incoming is not null then
    perform public.respond_friend_request(v_incoming, true);
    return 'friend';
  end if;

  insert into public.friend_requests (sender_id, recipient_id)
  values (v_uid, p_user_id)
  on conflict do nothing;

  return 'request_sent';
end;
$$;

create or replace function public.respond_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.friend_requests;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_req
  from public.friend_requests r
  where r.id = p_request_id and r.status = 'pending'
  for update;

  if v_req.id is null then
    raise exception 'no_such_request' using errcode = '02000';
  end if;
  if v_req.recipient_id <> v_uid then
    raise exception 'not_your_request' using errcode = '42501';
  end if;
  if public.blocked_either_way(v_req.sender_id, v_req.recipient_id) then
    update public.friend_requests set status = 'cancelled', responded_at = now()
     where id = p_request_id;
    return 'declined';
  end if;

  if not p_accept then
    update public.friend_requests set status = 'declined', responded_at = now()
     where id = p_request_id;
    return 'declined';
  end if;

  update public.friend_requests set status = 'accepted', responded_at = now()
   where id = p_request_id;

  -- Both directions, always. The graph is never half-connected.
  insert into public.friendships (user_id, friend_id) values
    (v_req.sender_id, v_req.recipient_id),
    (v_req.recipient_id, v_req.sender_id)
  on conflict do nothing;

  return 'friend';
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.friend_requests
     set status = 'cancelled', responded_at = now()
   where id = p_request_id
     and status = 'pending'
     and sender_id = v_uid;
end;
$$;

create or replace function public.unfriend(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  delete from public.friendships
   where (user_id = v_uid and friend_id = p_user_id)
      or (user_id = p_user_id and friend_id = v_uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- SAFETY
-- ---------------------------------------------------------------------------

create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_uid = p_user_id then
    raise exception 'cannot_block_self' using errcode = '22023';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_user_id)
  on conflict do nothing;

  -- A block is total: the edge goes, and so does anything pending.
  delete from public.friendships
   where (user_id = v_uid and friend_id = p_user_id)
      or (user_id = p_user_id and friend_id = v_uid);

  update public.friend_requests
     set status = 'cancelled', responded_at = now()
   where status = 'pending'
     and ((sender_id = v_uid and recipient_id = p_user_id)
       or (sender_id = p_user_id and recipient_id = v_uid));
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.blocks
   where blocker_id = auth.uid() and blocked_id = p_user_id;
end;
$$;

create or replace function public.report_user(
  p_user_id uuid,
  p_reason public.report_reason,
  p_detail text default null,
  p_also_block boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_uid = p_user_id then
    raise exception 'cannot_report_self' using errcode = '22023';
  end if;

  insert into public.reports (reporter_id, reported_id, reason, detail)
  values (v_uid, p_user_id, p_reason, nullif(btrim(coalesce(p_detail, '')), ''));

  if p_also_block then
    perform public.block_user(p_user_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- THE LIST  (the one screen that matters)
-- ---------------------------------------------------------------------------

-- security invoker on purpose: it reads only rows the caller's own policies
-- already allow, so RLS stays the single source of truth.
create or replace function public.friends_with_presence()
returns table (
  user_id      uuid,
  handle       text,
  display_name text,
  avatar_url   text,
  is_live      boolean,
  agent        public.agent_kind
)
language sql
stable
set search_path = ''
as $$
  select p.id,
         p.handle::text,
         p.display_name,
         p.avatar_url,
         coalesce(pr.is_live, false),
         pr.agent
  from public.friendships f
  join public.profiles p on p.id = f.friend_id
  left join public.presence pr on pr.user_id = f.friend_id
  where f.user_id = auth.uid()
  order by coalesce(pr.is_live, false) desc, p.handle;
$$;

-- Friends of your friends, ranked by how many people you have in common.
create or replace function public.suggested_friends(p_limit int default 20)
returns table (
  user_id       uuid,
  handle        text,
  display_name  text,
  avatar_url    text,
  mutual_count  int,
  mutual_sample text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  with mine as (
    select f.friend_id from public.friendships f where f.user_id = v_uid
  ),
  fof as (
    select theirs.friend_id as candidate,
           mine.friend_id   as via
    from mine
    join public.friendships theirs on theirs.user_id = mine.friend_id
    where theirs.friend_id <> v_uid
      and theirs.friend_id not in (select friend_id from mine)
  ),
  ranked as (
    select fof.candidate,
           count(*)::int as mutuals,
           (array_agg(via_p.handle::text order by via_p.handle))[1:3] as sample
    from fof
    join public.profiles via_p on via_p.id = fof.via
    group by fof.candidate
  )
  select r.candidate,
         p.handle::text,
         p.display_name,
         p.avatar_url,
         r.mutuals,
         r.sample
  from ranked r
  join public.profiles p on p.id = r.candidate
  where not public.blocked_either_way(v_uid, r.candidate)
    and not public.has_open_request(v_uid, r.candidate)
  order by r.mutuals desc, p.handle
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end;
$$;

-- ---------------------------------------------------------------------------
-- ERASURE  (App Store 5.1.1(v) and GDPR Art. 17 are the same button)
-- ---------------------------------------------------------------------------

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Reports survive the account, tombstoned. Abuse prevention, nothing else:
  -- they carry no handle, no email, no content.
  update public.reports set reporter_id = null where reporter_id = v_uid;
  update public.reports set reported_id = null where reported_id = v_uid;

  -- Everything else hangs off auth.users by cascade: profile, presence,
  -- devices and their tokens, both halves of every edge, requests, blocks,
  -- invite and pairing codes, push tokens.
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- EXECUTE GRANTS
-- ---------------------------------------------------------------------------

grant execute on function public.claim_handle(text, text)                     to authenticated;
grant execute on function public.rotate_invite_code()                         to authenticated;
grant execute on function public.create_pairing_code()                        to authenticated;
grant execute on function public.relationship_to(uuid)                        to authenticated;
grant execute on function public.lookup_invite(text)                          to authenticated;
grant execute on function public.send_friend_request(uuid)                    to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean)        to authenticated;
grant execute on function public.cancel_friend_request(uuid)                  to authenticated;
grant execute on function public.unfriend(uuid)                               to authenticated;
grant execute on function public.block_user(uuid)                             to authenticated;
grant execute on function public.unblock_user(uuid)                           to authenticated;
grant execute on function public.report_user(uuid, public.report_reason, text, boolean) to authenticated;
grant execute on function public.friends_with_presence()                      to authenticated;
grant execute on function public.suggested_friends(int)                       to authenticated;
grant execute on function public.delete_account()                             to authenticated;

-- gen_code and normalize_code are internal. No grant.
