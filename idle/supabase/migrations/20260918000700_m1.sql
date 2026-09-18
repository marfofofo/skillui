-- IDLE — the pieces the stores ask for.
--
-- Three things named in docs/COMPLIANCE.md that had no implementation, and the
-- one artefact App Review cannot do without.

-- ---------------------------------------------------------------------------
-- WHO YOU HAVE BLOCKED
-- ---------------------------------------------------------------------------
--
-- You can read your own rows in `blocks`, but not the PROFILES they point at —
-- blocking hides a person from you completely, including from yourself. So the
-- list has to come from a function that can see past that policy, and it returns
-- nothing but the handle you need in order to undo it.

create or replace function public.my_blocks()
returns table (
  user_id      uuid,
  handle       text,
  display_name text,
  created_at   timestamptz
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
  select p.id, p.handle::text, p.display_name, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = v_uid
  order by b.created_at desc;
end;
$$;

grant execute on function public.my_blocks() to authenticated;

-- ---------------------------------------------------------------------------
-- EVERYTHING WE HOLD ABOUT YOU  (GDPR Art. 20)
-- ---------------------------------------------------------------------------
--
-- One call, one JSON document, no ticket and no waiting. What it returns is the
-- whole of it — if a table is missing from here, either it holds nothing about a
-- person or this function is wrong.

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object('email', u.email, 'created_at', u.created_at)
      from auth.users u where u.id = v_uid
    ),
    'profile', (
      select to_jsonb(p) - 'id' from public.profiles p where p.id = v_uid
    ),
    'settings', (
      select to_jsonb(s) - 'user_id' from public.user_settings s where s.user_id = v_uid
    ),
    'invite_code', (
      select c.code from public.invite_codes c where c.user_id = v_uid
    ),
    -- Presence is a single current state, not a history. There is nothing to
    -- export but what is true right now, and that is the point.
    'presence_now', (
      select jsonb_build_object('is_live', pr.is_live, 'agent', pr.agent)
      from public.presence pr where pr.user_id = v_uid
    ),
    'terminals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', d.label, 'agent', d.agent,
        'paired_at', d.created_at, 'last_seen_at', d.last_seen_at,
        'revoked_at', d.revoked_at))
      from public.devices d where d.user_id = v_uid
    ), '[]'::jsonb),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object('handle', p.handle, 'since', f.created_at))
      from public.friendships f join public.profiles p on p.id = f.friend_id
      where f.user_id = v_uid
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'direction', case when r.sender_id = v_uid then 'sent' else 'received' end,
        'status', r.status, 'created_at', r.created_at))
      from public.friend_requests r
      where r.sender_id = v_uid or r.recipient_id = v_uid
    ), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('handle', p.handle, 'at', b.created_at))
      from public.blocks b join public.profiles p on p.id = b.blocked_id
      where b.blocker_id = v_uid
    ), '[]'::jsonb),
    -- The hash itself, so you can verify it is what we say: a salted digest of
    -- your own verified address and nothing else.
    'contact_hashes', coalesce((
      select jsonb_agg(jsonb_build_object('kind', ch.kind, 'hash', ch.hash))
      from public.contact_hashes ch where ch.user_id = v_uid
    ), '[]'::jsonb),
    'push_tokens', coalesce((
      select jsonb_agg(jsonb_build_object('platform', t.platform, 'created_at', t.created_at))
      from public.push_tokens t where t.user_id = v_uid
    ), '[]'::jsonb),
    'not_held', jsonb_build_array(
      'No history of when you were awake — presence is current state only',
      'No working directories, repository names, prompts, code or tool output',
      'No contacts. Matching happens on your device; we never receive them',
      'No location, no advertising identifiers, no third-party analytics'
    )
  ) into v_out;

  return v_out;
end;
$$;

grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- THE REVIEWER'S ACCOUNT
-- ---------------------------------------------------------------------------
--
-- App Review cannot install Claude Code and pair a terminal, so without this
-- they open the app, see an empty list, and reject it under 4.2 — the single
-- likeliest rejection in the whole submission.
--
-- These accounts' presence is driven on a schedule instead of by a heartbeat.
-- Everything else about them is an ordinary account.

create table public.demo_accounts (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  /** Minutes in an hour this account is awake, so the list actually changes. */
  live_from  int not null default 0,
  live_to    int not null default 40,
  agent      public.agent_kind not null default 'claude_code',

  constraint demo_window check (live_from between 0 and 59 and live_to between 0 and 60)
);

alter table public.demo_accounts enable row level security;
revoke all on public.demo_accounts from anon, authenticated;

comment on table public.demo_accounts is
  'Accounts whose presence is simulated for App Review. Never created by signup — only by supabase/demo.sql.';

create or replace function public.refresh_demo_presence()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minute int := extract(minute from now())::int;
  v_count int;
begin
  update public.presence pr
     set is_live = (v_minute >= d.live_from and v_minute < d.live_to),
         agent = case when (v_minute >= d.live_from and v_minute < d.live_to)
                      then d.agent else null end,
         session_started_at = case when (v_minute >= d.live_from and v_minute < d.live_to)
                                   then coalesce(pr.session_started_at, now()) else null end,
         -- Kept fresh so sweep_presence() never switches a demo account off.
         last_heartbeat_at = now(),
         updated_at = now()
    from public.demo_accounts d
   where d.user_id = pr.user_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
begin
  perform cron.schedule('idle-demo-presence', '* * * * *',
    'select public.refresh_demo_presence()');
exception when others then
  raise notice 'IDLE: could not schedule demo presence';
end
$$;
