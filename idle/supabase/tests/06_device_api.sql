-- "IDLE" — the terminal half: pairing, heartbeats, and the light going out.
\echo '# DEVICE API'
begin;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  v_code text;
  v_device uuid;
  v_handle text;
  v_ok boolean;
  v_swept int;
begin
  perform tests.as_user(marcus);

  -- PAIRING -----------------------------------------------------------------
  select c.code into v_code from public.create_pairing_code() c;
  perform tests.eq(length(v_code), 6, 'a pairing code is six characters');
  perform tests.ok(v_code !~ '[01OIL]', 'from an alphabet you can read aloud');

  select d.device_id, d.handle into v_device, v_handle
  from public.pair_device(v_code, 'hash-of-token-one', 'test-machine', null) d;
  perform tests.eq(v_handle, 'marcus', 'pairing returns the account it joined');
  perform tests.ok(v_device is not null, 'and creates a device');

  perform tests.raises(
    format('select public.pair_device(%L, %L, null, null)', v_code, 'hash-two'),
    'invalid_code',
    'a pairing code is single use');

  perform tests.raises(
    'select public.pair_device(''ZZZZZZ'', ''hash-three'', null, null)',
    'invalid_code',
    'an unknown pairing code is refused');

  -- HEARTBEATS --------------------------------------------------------------
  select public.record_heartbeat('hash-of-token-one', 'session_start', 'claude_code') into v_ok;
  perform tests.ok(v_ok, 'a valid device token is accepted');

  perform tests.ok(
    (select is_live from tests.presence_raw where handle = 'marcus'),
    'and the light comes on');

  perform tests.eq(
    (select agent::text from tests.presence_raw where handle = 'marcus'),
    'claude_code',
    'c/o CLAUDE CODE');

  select public.record_heartbeat('not-a-real-token', 'heartbeat', 'codex') into v_ok;
  perform tests.ok(not v_ok, 'an unknown device token is rejected');

  -- A revoked device stops reporting immediately.
  update public.devices set revoked_at = now() where id = v_device;
  select public.record_heartbeat('hash-of-token-one', 'heartbeat', 'claude_code') into v_ok;
  perform tests.ok(not v_ok, 'a revoked device stops being believed');
  update public.devices set revoked_at = null where id = v_device;

  -- THE LIGHT GOING OUT -----------------------------------------------------
  perform public.record_heartbeat('hash-of-token-one', 'heartbeat', 'claude_code');
  perform tests.ok(
    (select is_live from tests.presence_raw where handle = 'marcus'),
    'still building');

  update public.presence set last_heartbeat_at = now() - interval '10 minutes'
   where user_id = marcus;
  update public.devices set last_seen_at = now() - interval '10 minutes' where id = v_device;

  select public.sweep_presence() into v_swept;
  perform tests.eq(v_swept, 1, 'the sweep catches a terminal that stopped reporting');

  perform tests.ok(
    not (select is_live from tests.presence_raw where handle = 'marcus'),
    'and the light goes out on its own after 8 minutes');

  perform tests.eq(
    (select agent::text from tests.presence_raw where handle = 'marcus'),
    null::text,
    'the c/o line goes back to an em dash');

  -- EXPLICIT SESSION END ----------------------------------------------------
  perform public.record_heartbeat('hash-of-token-one', 'session_start', 'codex');
  perform tests.ok(
    (select is_live from tests.presence_raw where handle = 'marcus'),
    'a new session turns it back on');

  perform public.record_heartbeat('hash-of-token-one', 'session_end', 'codex');
  perform tests.ok(
    not (select is_live from tests.presence_raw where handle = 'marcus'),
    'and session_end turns it off immediately');

  -- TWO TERMINALS -----------------------------------------------------------
  select c.code into v_code from public.create_pairing_code() c;
  perform public.pair_device(v_code, 'hash-of-token-two', 'second-machine', null);

  perform public.record_heartbeat('hash-of-token-one', 'session_start', 'claude_code');
  perform public.record_heartbeat('hash-of-token-two', 'session_start', 'codex');
  perform public.record_heartbeat('hash-of-token-one', 'session_end', 'claude_code');

  perform tests.ok(
    (select is_live from tests.presence_raw where handle = 'marcus'),
    'closing one terminal does not go dark while another is still running');

  -- RATE LIMITS -------------------------------------------------------------
  perform tests.ok(public.rate_limit_hit('test', 'k', 2, interval '1 hour'), 'first hit allowed');
  perform tests.ok(public.rate_limit_hit('test', 'k', 2, interval '1 hour'), 'second hit allowed');
  perform tests.ok(not public.rate_limit_hit('test', 'k', 2, interval '1 hour'), 'third hit refused');
  perform tests.ok(public.rate_limit_hit('test', 'other', 2, interval '1 hour'),
    'and the limit is per key');
end
$$;

rollback;
