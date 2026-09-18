-- "IDLE" — the lights go out on their own
--
-- A terminal that is killed, loses power, or loses network never sends
-- session_end. Presence must therefore decay rather than be switched off, and
-- it must decay as a real UPDATE so Realtime pushes it to friends' phones.

create or replace function public.sweep_presence()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.presence
     set is_live = false,
         agent = null,
         session_started_at = null,
         updated_at = now()
   where is_live
     and (last_heartbeat_at is null
          or last_heartbeat_at < now() - interval '8 minutes');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.sweep_presence() is
  'Flips stale presence to idle. Runs every minute. The 8 minute window is ~5x the agent''s 90s heartbeat throttle.';

-- pg_cron is not available in every local stack; never fail a migration over it.
do $$
begin
  execute 'create extension if not exists pg_cron';
exception when others then
  raise notice '"IDLE": pg_cron unavailable, schedule sweep_presence() externally';
end
$$;

do $$
begin
  perform cron.unschedule('idle-presence-sweep');
exception when others then
  null;
end
$$;

do $$
begin
  perform cron.schedule(
    'idle-presence-sweep',
    '* * * * *',
    'select public.sweep_presence()'
  );
exception when others then
  raise notice '"IDLE": could not schedule presence sweep';
end
$$;

-- Old pairing codes are single-use and short-lived; nothing needs them after a
-- day, and they are the only short secret we store in the clear.
create or replace function public.sweep_pairing_codes()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.pairing_codes
   where created_at < now() - interval '1 day';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
begin
  perform cron.schedule(
    'idle-pairing-code-sweep',
    '17 * * * *',
    'select public.sweep_pairing_codes()'
  );
exception when others then
  raise notice '"IDLE": could not schedule pairing code sweep';
end
$$;
