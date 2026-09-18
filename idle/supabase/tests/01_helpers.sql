-- "IDLE" — assertions.

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.ok(condition boolean, label text)
returns void language plpgsql as $$
begin
  if condition then
    raise notice '  ok    %', label;
  else
    raise exception 'FAIL  %', label using errcode = 'P0001';
  end if;
end;
$$;

create or replace function tests.eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is not distinct from expected then
    raise notice '  ok    %', label;
  else
    raise exception 'FAIL  % (got %, expected %)', label, actual, expected
      using errcode = 'P0001';
  end if;
end;
$$;

/** Asserts that a statement is refused. Used for the column-level grants. */
create or replace function tests.denied(statement text, label text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAIL  % — it was ALLOWED', label using errcode = 'P0001';
exception
  when insufficient_privilege then
    raise notice '  ok    % (denied)', label;
  when others then
    if sqlerrm like 'FAIL%' then
      raise;
    end if;
    raise notice '  ok    % (refused: %)', label, sqlstate;
end;
$$;

/** Become a signed-in account, the way PostgREST does. */
create or replace function tests.as_user(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

create or replace view tests.people as
  select 'marcus'::text as handle, '11111111-1111-4111-8111-111111111111'::uuid as id
  union all select 'sofia',  '22222222-2222-4222-8222-222222222222'
  union all select 'luca',   '33333333-3333-4333-8333-333333333333'
  union all select 'giulia', '44444444-4444-4444-8444-444444444444';

grant select on tests.people to anon, authenticated, service_role;

-- Superuser-owned views, so a test can inspect the truth regardless of the
-- policies under test. Never created outside tests/.
create or replace view tests.codes as
  select p.handle::text as handle, c.code
  from public.invite_codes c join public.profiles p on p.id = c.user_id;

create or replace view tests.edges as
  select a.handle::text as who, b.handle::text as friend
  from public.friendships f
  join public.profiles a on a.id = f.user_id
  join public.profiles b on b.id = f.friend_id;

create or replace view tests.presence_raw as
  select p.handle::text as handle, pr.is_live, pr.agent,
         pr.session_started_at, pr.last_heartbeat_at
  from public.presence pr join public.profiles p on p.id = pr.user_id;

grant select on tests.codes, tests.edges, tests.presence_raw
  to anon, authenticated, service_role;

create or replace view tests.reports_raw as
  select r.id, r.reason, r.detail, r.resolved_at,
         rp.handle::text as reporter, tp.handle::text as reported,
         r.reporter_id, r.reported_id
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles tp on tp.id = r.reported_id;

create or replace view tests.devices_raw as
  select d.id, p.handle::text as owner, d.label, d.agent, d.revoked_at, d.last_seen_at
  from public.devices d join public.profiles p on p.id = d.user_id;

grant select on tests.reports_raw, tests.devices_raw to anon, authenticated, service_role;

/** Asserts that a statement raises, and that the message mentions `fragment`. */
create or replace function tests.raises(statement text, fragment text, label text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAIL  % — it did NOT raise', label using errcode = 'P0001';
exception
  when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if position(fragment in sqlerrm) > 0 then
      raise notice '  ok    % (raised %)', label, fragment;
    else
      raise exception 'FAIL  % — raised "%", expected "%"', label, sqlerrm, fragment
        using errcode = 'P0001';
    end if;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

create or replace view tests.contact_hashes_raw as
  select p.handle::text as handle, ch.kind, ch.hash
  from public.contact_hashes ch join public.profiles p on p.id = ch.user_id;

grant select on tests.contact_hashes_raw to anon, authenticated, service_role;

/** auth.users belongs to the platform; tests reach it through here. */
create or replace function tests.set_auth_email(p_uid uuid, p_email text, p_confirmed boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
     set email = p_email,
         email_confirmed_at = case when p_confirmed then now() else null end
   where id = p_uid;
end;
$$;

grant execute on function tests.set_auth_email(uuid, text, boolean) to authenticated;

/** demo_accounts is service-role only; tests reach it through here. */
create or replace function tests.make_demo(
  p_uid uuid, p_from int, p_to int, p_agent public.agent_kind
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.demo_accounts (user_id, live_from, live_to, agent)
  values (p_uid, p_from, p_to, p_agent)
  on conflict (user_id) do update
    set live_from = excluded.live_from,
        live_to = excluded.live_to,
        agent = excluded.agent;
end;
$$;

grant execute on function tests.make_demo(uuid, int, int, public.agent_kind) to authenticated;

create or replace view tests.notifications_raw as
  select n.id, p.handle::text as recipient, n.kind::text as kind,
         n.payload ->> 'handle' as about, n.sent_at, n.attempts
  from public.notifications n join public.profiles p on p.id = n.user_id;

grant select on tests.notifications_raw to anon, authenticated, service_role;

/** push_tokens is the user's own, but tests need to plant one for anybody. */
create or replace function tests.give_push_token(p_uid uuid, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_tokens (user_id, expo_token, platform)
  values (p_uid, p_token, 'test')
  on conflict (expo_token) do nothing;
end;
$$;

grant execute on function tests.give_push_token(uuid, text) to authenticated;

/** presence is written only by the heartbeat function; tests drive it here. */
create or replace function tests.set_presence(
  p_uid uuid, p_live boolean, p_agent public.agent_kind default 'claude_code'
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.presence
     set is_live = p_live,
         agent = case when p_live then p_agent else null end,
         last_heartbeat_at = now(),
         updated_at = now()
   where user_id = p_uid;
end;
$$;

/** A heartbeat that does NOT change is_live — the case that must not notify. */
create or replace function tests.beat(p_uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.presence set last_heartbeat_at = now(), is_live = is_live
   where user_id = p_uid;
end;
$$;

grant execute on function tests.set_presence(uuid, boolean, public.agent_kind) to authenticated;
grant execute on function tests.beat(uuid) to authenticated;

/** The drain is service-role only; these let a test stand in for it. */
create or replace function tests.claim(p_limit int)
returns table (id uuid, kind public.notification_kind, payload jsonb, tokens text[])
language sql security definer set search_path = '' as $$
  select * from public.claim_notifications(p_limit);
$$;

create or replace function tests.mark_sent(p_ids uuid[])
returns int language sql security definer set search_path = '' as $$
  select public.mark_notifications_sent(p_ids);
$$;

create or replace function tests.enqueue_exhausted(p_uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, payload, attempts)
  values (p_uid, 'friend_request', '{"handle":"nobody"}'::jsonb, 3);
end;
$$;

grant execute on function tests.claim(int) to authenticated;
grant execute on function tests.mark_sent(uuid[]) to authenticated;
grant execute on function tests.enqueue_exhausted(uuid) to authenticated;
