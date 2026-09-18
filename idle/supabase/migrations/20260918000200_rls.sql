-- "IDLE" — grants and row-level security
--
-- Two layers, on purpose:
--   1. GRANTS decide which *columns* a signed-in account may ever read.
--   2. RLS decides which *rows*.
-- The privacy promise in PRESENCE_PROTOCOL.md §7 is enforced by layer 1, so it
-- survives a mistake in layer 2.

-- Supabase's default privileges hand every new table to anon/authenticated.
-- Take it all back first and grant deliberately.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- HELPERS  (security definer so policies never recurse into RLS)
-- ---------------------------------------------------------------------------

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.user_id = a and f.friend_id = b
  );
$$;

create or replace function public.blocked_either_way(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b)
       or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

create or replace function public.has_open_request(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friend_requests r
    where r.status = 'pending'
      and ((r.sender_id = a and r.recipient_id = b)
        or (r.sender_id = b and r.recipient_id = a))
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.blocked_either_way(uuid, uuid) to authenticated;
grant execute on function public.has_open_request(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

grant select (id, handle, display_name, avatar_url, bio, created_at)
  on public.profiles to authenticated;
grant update (display_name, avatar_url, bio) on public.profiles to authenticated;

-- You may read a profile if it is yours, if you are friends, or if there is an
-- open request between you. Never if either of you has blocked the other.
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (
      not public.blocked_either_way((select auth.uid()), id)
      and (
        public.are_friends((select auth.uid()), id)
        or public.has_open_request((select auth.uid()), id)
      )
    )
  );

create policy profiles_write_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Profiles are created by the claim_handle() RPC, never by a direct insert.

-- ---------------------------------------------------------------------------
-- SETTINGS
-- ---------------------------------------------------------------------------

alter table public.user_settings enable row level security;

grant select, insert, update on public.user_settings to authenticated;

create policy settings_own on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- PRESENCE  -- the column grant is the privacy guarantee
-- ---------------------------------------------------------------------------

alter table public.presence enable row level security;

-- is_live and agent. Not session_started_at, not last_heartbeat_at: no signed-in
-- account can read how long anyone has been working, by any query, ever.
grant select (user_id, is_live, agent, updated_at) on public.presence to authenticated;

create policy presence_read_friends on public.presence
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.are_friends((select auth.uid()), user_id)
      and not public.blocked_either_way((select auth.uid()), user_id)
    )
  );

-- Written only by the heartbeat edge function, which runs as service_role after
-- authenticating a device token. No write grant for authenticated exists.

-- ---------------------------------------------------------------------------
-- DEVICES
-- ---------------------------------------------------------------------------

alter table public.devices enable row level security;

-- token_hash is deliberately absent.
grant select (id, user_id, label, agent, created_at, last_seen_at, revoked_at)
  on public.devices to authenticated;
grant update (label, revoked_at) on public.devices to authenticated;
grant delete on public.devices to authenticated;

create policy devices_own on public.devices
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy devices_revoke_own on public.devices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy devices_delete_own on public.devices
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- PAIRING CODES
-- ---------------------------------------------------------------------------

alter table public.pairing_codes enable row level security;

grant select (code, user_id, created_at, expires_at, consumed_at) on public.pairing_codes to authenticated;

create policy pairing_codes_own on public.pairing_codes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Issued by create_pairing_code(), consumed by the pair edge function.

-- ---------------------------------------------------------------------------
-- INVITE CODES
-- ---------------------------------------------------------------------------

alter table public.invite_codes enable row level security;

grant select on public.invite_codes to authenticated;

create policy invite_codes_own on public.invite_codes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Someone else's code is resolved through lookup_invite(), which returns a
-- preview and nothing more. You can never enumerate codes.

-- ---------------------------------------------------------------------------
-- FRIENDSHIPS
-- ---------------------------------------------------------------------------

alter table public.friendships enable row level security;

grant select on public.friendships to authenticated;

create policy friendships_own on public.friendships
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Edges are written by respond_friend_request() and removed by unfriend() /
-- block_user(), always in both directions. No direct write grant.

-- ---------------------------------------------------------------------------
-- FRIEND REQUESTS
-- ---------------------------------------------------------------------------

alter table public.friend_requests enable row level security;

grant select on public.friend_requests to authenticated;

create policy friend_requests_party on public.friend_requests
  for select to authenticated
  using (
    sender_id = (select auth.uid()) or recipient_id = (select auth.uid())
  );

-- Sent by send_friend_request(), answered by respond_friend_request().

-- ---------------------------------------------------------------------------
-- BLOCKS
-- ---------------------------------------------------------------------------

alter table public.blocks enable row level security;

grant select on public.blocks to authenticated;

create policy blocks_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

-- A blocked account is never told it was blocked: it can read nothing here.
-- Written by block_user() / unblock_user().

-- ---------------------------------------------------------------------------
-- REPORTS  -- write-only for everyone except moderation
-- ---------------------------------------------------------------------------

alter table public.reports enable row level security;

-- No select grant at all: nobody can read the report queue through the API.

-- ---------------------------------------------------------------------------
-- PUSH TOKENS
-- ---------------------------------------------------------------------------

alter table public.push_tokens enable row level security;

grant select, insert, delete on public.push_tokens to authenticated;

create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------------------------

-- Friends' phones learn about a light going on or off from this publication.
-- Realtime honours RLS, so a subscriber only ever receives rows the policies
-- above already let them read.
alter publication supabase_realtime add table public.presence;
alter publication supabase_realtime add table public.friend_requests;
