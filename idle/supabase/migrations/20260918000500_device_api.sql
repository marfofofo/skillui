-- "IDLE" — the device-token half of the API
--
-- Terminals do not have a user session, they have a device token. These two
-- functions are the entire surface a paired terminal can reach, and they are
-- callable only by service_role (i.e. only from the edge functions, which
-- authenticate the token first).

-- ---------------------------------------------------------------------------
-- RATE LIMITING  (stateless edge functions, stateful database)
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  bucket      text not null,
  key         text not null,
  window_start timestamptz not null,
  hits        int not null default 0,
  primary key (bucket, key, window_start)
);

alter table public.rate_limits enable row level security;

-- Supabase's default privileges grant every NEW table in public to anon and
-- authenticated. Migration 000200 revoked what existed then; this table is
-- created afterwards, so it must take its own grants back explicitly.
-- Row-level security already returns nothing without a policy, but a table
-- nobody may touch should also carry no grant. Enforced by tests/02_privacy.sql.
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(
  p_bucket text,
  p_key text,
  p_limit int,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := date_trunc('hour', now())
    + floor(extract(epoch from (now() - date_trunc('hour', now()))) /
            extract(epoch from p_window)) * p_window;
  v_hits int;
begin
  insert into public.rate_limits (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window, 1)
  on conflict (bucket, key, window_start)
    do update set hits = rate_limits.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

create or replace function public.sweep_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

do $$
begin
  perform cron.schedule('idle-rate-limit-sweep', '23 * * * *',
    'select public.sweep_rate_limits()');
exception when others then
  raise notice '"IDLE": could not schedule rate limit sweep';
end
$$;

-- ---------------------------------------------------------------------------
-- PAIR  (terminal redeems a 6-character code for a device token)
-- ---------------------------------------------------------------------------

create or replace function public.pair_device(
  p_code       text,
  p_token_hash text,
  p_label      text default null,
  p_agent      public.agent_kind default null
)
returns table (device_id uuid, handle text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.normalize_code(p_code);
  v_pairing public.pairing_codes;
  v_device_id uuid;
  v_handle text;
begin
  select * into v_pairing
  from public.pairing_codes pc
  where pc.code = v_code
  for update;

  if v_pairing.code is null
     or v_pairing.consumed_at is not null
     or v_pairing.expires_at <= now() then
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  insert into public.devices (user_id, label, token_hash, agent)
  values (
    v_pairing.user_id,
    nullif(btrim(coalesce(p_label, '')), ''),
    p_token_hash,
    p_agent
  )
  returning id into v_device_id;

  update public.pairing_codes
     set consumed_at = now(), consumed_by = v_device_id
   where code = v_code;

  select p.handle::text into v_handle
  from public.profiles p where p.id = v_pairing.user_id;

  return query select v_device_id, v_handle;
end;
$$;

-- ---------------------------------------------------------------------------
-- HEARTBEAT  (the only thing a terminal ever does again)
-- ---------------------------------------------------------------------------

create or replace function public.record_heartbeat(
  p_token_hash text,
  p_event      text,
  p_agent      public.agent_kind default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices;
begin
  select * into v_device
  from public.devices d
  where d.token_hash = p_token_hash and d.revoked_at is null;

  if v_device.id is null then
    return false;
  end if;

  update public.devices
     set last_seen_at = now(),
         agent = coalesce(p_agent, agent)
   where id = v_device.id;

  if p_event = 'session_end' then
    -- Another terminal of yours may still be live; only go dark if this was
    -- the last one to report in.
    if not exists (
      select 1 from public.devices d2
      where d2.user_id = v_device.user_id
        and d2.id <> v_device.id
        and d2.revoked_at is null
        and d2.last_seen_at > now() - interval '8 minutes'
    ) then
      update public.presence
         set is_live = false,
             agent = null,
             session_started_at = null,
             updated_at = now()
       where user_id = v_device.user_id;
    end if;
    return true;
  end if;

  insert into public.presence (
    user_id, is_live, agent, session_started_at, last_heartbeat_at, updated_at
  )
  values (v_device.user_id, true, p_agent, now(), now(), now())
  on conflict (user_id) do update
    set is_live = true,
        agent = coalesce(excluded.agent, presence.agent),
        session_started_at = case
          when p_event = 'session_start' or not presence.is_live
            then now()
          else presence.session_started_at
        end,
        last_heartbeat_at = now(),
        updated_at = now();

  return true;
end;
$$;

-- service_role only. authenticated gets nothing here.
revoke all on function public.rate_limit_hit(text, text, int, interval) from public, anon, authenticated;
revoke all on function public.pair_device(text, text, text, public.agent_kind) from public, anon, authenticated;
revoke all on function public.record_heartbeat(text, text, public.agent_kind) from public, anon, authenticated;
