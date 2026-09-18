-- "IDLE" — core schema
-- Two states, one graph, four fields on the wire.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- TYPES
-- ---------------------------------------------------------------------------

create type public.agent_kind as enum ('claude_code', 'codex');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'cancelled');
create type public.report_reason as enum (
  'impersonation', 'harassment', 'spam', 'sexual_content', 'hate', 'other'
);

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        extensions.citext not null unique,
  display_name  text,
  avatar_url    text,
  bio           text,
  created_at    timestamptz not null default now(),

  constraint handle_format check (handle ~ '^[a-z0-9_]{3,20}$'),
  constraint bio_length check (bio is null or char_length(bio) <= 140),
  constraint display_name_length
    check (display_name is null or char_length(display_name) between 1 and 40)
);

comment on table public.profiles is
  'One row per account. Everything here is visible to friends; nothing here is sensitive.';

-- Handles we never hand out. Guideline 1.2 asks for a filtering mechanism;
-- this is the write-time half of it.
create table public.reserved_handles (
  handle extensions.citext primary key
);

insert into public.reserved_handles (handle) values
  ('idle'), ('admin'), ('root'), ('support'), ('help'), ('staff'), ('team'),
  ('moderator'), ('mod'), ('security'), ('abuse'), ('legal'), ('privacy'),
  ('billing'), ('api'), ('www'), ('app'), ('official'), ('system'), ('null'),
  ('undefined'), ('anonymous'), ('everyone'), ('me'), ('you'), ('claude'),
  ('codex'), ('openai'), ('anthropic');

create or replace function public.enforce_handle_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.reserved_handles r where r.handle = new.handle) then
    raise exception 'handle_reserved' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_handle_policy
  before insert or update of handle on public.profiles
  for each row execute function public.enforce_handle_policy();

-- ---------------------------------------------------------------------------
-- SETTINGS  (kept out of profiles so it is never readable by another account)
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id                uuid primary key references public.profiles (id) on delete cascade,
  notify_on_friend_live  boolean not null default false,
  notify_on_request      boolean not null default true,
  discoverable_by_handle boolean not null default true,
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INVITE CODES  (your permanent personal code — the link and the QR)
-- ---------------------------------------------------------------------------

create table public.invite_codes (
  code       text primary key,
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  rotated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DEVICES  (a paired terminal)
-- ---------------------------------------------------------------------------

create table public.devices (
  id           uuid primary key default extensions.gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  label        text,
  token_hash   text not null unique,
  agent        public.agent_kind,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz,

  constraint label_length check (label is null or char_length(label) <= 60)
);

create index devices_user_active_idx
  on public.devices (user_id) where revoked_at is null;

comment on column public.devices.token_hash is
  'SHA-256 of the device token. The token itself is returned once, at pairing, and never stored.';

-- ---------------------------------------------------------------------------
-- PAIRING CODES  (app -> terminal, single use, 10 minutes)
-- ---------------------------------------------------------------------------

create table public.pairing_codes (
  code        text primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references public.devices (id) on delete set null
);

create index pairing_codes_user_idx on public.pairing_codes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- PRESENCE  (one row per account, the whole point of the product)
-- ---------------------------------------------------------------------------

create table public.presence (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  is_live            boolean not null default false,
  agent              public.agent_kind,
  session_started_at timestamptz,
  last_heartbeat_at  timestamptz,
  updated_at         timestamptz not null default now()
);

comment on column public.presence.session_started_at is
  'Server-side only. The state machine needs it; no friend-reachable grant exposes it. See PRESENCE_PROTOCOL.md §7.';

create index presence_live_idx on public.presence (user_id) where is_live;

-- ---------------------------------------------------------------------------
-- THE GRAPH
-- ---------------------------------------------------------------------------

-- Mirrored edges: accepting a request writes both directions. Makes every
-- "my friends" query a plain index lookup and keeps RLS trivial.
create table public.friendships (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  friend_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (user_id, friend_id),
  constraint no_self_friendship check (user_id <> friend_id)
);

create index friendships_friend_idx on public.friendships (friend_id);

create table public.friend_requests (
  id           uuid primary key default extensions.gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status       public.request_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,

  constraint no_self_request check (sender_id <> recipient_id)
);

create unique index friend_requests_one_pending
  on public.friend_requests (sender_id, recipient_id)
  where status = 'pending';

create index friend_requests_inbox_idx
  on public.friend_requests (recipient_id, created_at desc)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- SAFETY  (App Store Guideline 1.2 — block, report)
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id          uuid primary key default extensions.gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_id uuid references public.profiles (id) on delete set null,
  reason      public.report_reason not null,
  detail      text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolution  text,

  constraint detail_length check (detail is null or char_length(detail) <= 500)
);

create index reports_open_idx on public.reports (created_at) where resolved_at is null;

comment on table public.reports is
  'Retained after account deletion (abuse prevention) with reporter/reported tombstoned to null. 24-hour action SLA.';

-- ---------------------------------------------------------------------------
-- PUSH
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  id         uuid primary key default extensions.gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null unique,
  platform   text,
  created_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);
