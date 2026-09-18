-- IDLE — the only two notifications this product will ever send.
--
-- BRAND.md §11: a friend request, and — opt-in — a friend coming online. There
-- is no engagement notification, no "you have not opened the app in a while",
-- no digest. If a third kind is ever added, that rule is being broken.
--
-- SHAPE
--   Triggers write into an outbox. A scheduled edge function drains it and
--   talks to Expo's push service. Postgres never makes an outbound request on
--   the path of a user's action, so a slow push service can never slow down
--   accepting a friend or starting a coding session.

create type public.notification_kind as enum ('friend_request', 'friend_live');

create table public.notifications (
  id         uuid primary key default extensions.gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null,
  /** Only what the notification itself says. Never anything else about anyone. */
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  attempts   int not null default 0,
  last_error text
);

create index notifications_pending_idx
  on public.notifications (created_at) where sent_at is null;
create index notifications_user_kind_idx
  on public.notifications (user_id, kind, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

comment on table public.notifications is
  'Outbox. Drained by the notify edge function; never read by a client.';

-- ---------------------------------------------------------------------------
-- RESTRAINT
-- ---------------------------------------------------------------------------
--
-- A person with forty friends who all start work at nine would otherwise get
-- forty buzzes in a minute. These two limits are the difference between a
-- product that tells you something and one you turn off.

/** At most one "came online" per friend per six hours. */
create or replace function public.recently_notified_about(p_user uuid, p_about uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notifications n
    where n.user_id = p_user
      and n.kind = 'friend_live'
      and n.payload ->> 'user_id' = p_about::text
      and n.created_at > now() - interval '6 hours'
  );
$$;

/** And at most five a day, whoever they are about. */
create or replace function public.notification_budget_left(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.notifications n
    where n.user_id = p_user
      and n.kind = 'friend_live'
      and n.created_at > now() - interval '1 day'
  ) < 5;
$$;

-- ---------------------------------------------------------------------------
-- A FRIEND ASKED
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  if not exists (
    select 1 from public.user_settings s
    where s.user_id = new.recipient_id and s.notify_on_request
  ) then
    return new;
  end if;

  select p.handle::text into v_handle from public.profiles p where p.id = new.sender_id;

  insert into public.notifications (user_id, kind, payload)
  values (
    new.recipient_id,
    'friend_request',
    jsonb_build_object('user_id', new.sender_id, 'handle', v_handle)
  );

  return new;
end;
$$;

create trigger friend_requests_notify
  after insert on public.friend_requests
  for each row execute function public.enqueue_request_notification();

-- ---------------------------------------------------------------------------
-- A FRIEND IS AWAKE
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_live_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text;
begin
  -- Only the moment a light comes ON. A heartbeat mid-session changes
  -- last_heartbeat_at and must not buzz anybody.
  if new.is_live is not true or old.is_live is true then
    return new;
  end if;

  select p.handle::text into v_handle from public.profiles p where p.id = new.user_id;

  insert into public.notifications (user_id, kind, payload)
  select f.user_id,
         'friend_live',
         jsonb_build_object(
           'user_id', new.user_id,
           'handle', v_handle,
           'agent', new.agent
         )
  from public.friendships f
  join public.user_settings s on s.user_id = f.user_id
  where f.friend_id = new.user_id
    and s.notify_on_friend_live
    and not public.blocked_either_way(f.user_id, new.user_id)
    and not public.recently_notified_about(f.user_id, new.user_id)
    and public.notification_budget_left(f.user_id);

  return new;
end;
$$;

create trigger presence_notify
  after update of is_live on public.presence
  for each row execute function public.enqueue_live_notifications();

-- ---------------------------------------------------------------------------
-- DRAINING
-- ---------------------------------------------------------------------------

/** What the notify function claims and sends. Service role only. */
create or replace function public.claim_notifications(p_limit int default 100)
returns table (
  id       uuid,
  kind     public.notification_kind,
  payload  jsonb,
  tokens   text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with claimed as (
    update public.notifications n
       set attempts = n.attempts + 1
     where n.id in (
       select n2.id from public.notifications n2
       where n2.sent_at is null
         and n2.attempts < 3
         -- Nothing older than a day is worth delivering.
         and n2.created_at > now() - interval '1 day'
       order by n2.created_at
       limit greatest(1, least(coalesce(p_limit, 100), 500))
       for update skip locked
     )
    returning n.id, n.user_id, n.kind, n.payload
  )
  select c.id, c.kind, c.payload,
         coalesce(array_agg(t.expo_token) filter (where t.expo_token is not null), '{}')
  from claimed c
  left join public.push_tokens t on t.user_id = c.user_id
  group by c.id, c.kind, c.payload;
end;
$$;

create or replace function public.mark_notifications_sent(p_ids uuid[], p_error text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.notifications
     set sent_at = case when p_error is null then now() else sent_at end,
         last_error = p_error
   where id = any (coalesce(p_ids, '{}'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.sweep_notifications()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.notifications
   where created_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_notifications(int) from public, anon, authenticated;
revoke all on function public.mark_notifications_sent(uuid[], text) from public, anon, authenticated;

do $$
begin
  perform cron.schedule('idle-notifications-sweep', '41 4 * * *',
    'select public.sweep_notifications()');
exception when others then
  raise notice 'IDLE: could not schedule notification sweep';
end
$$;
