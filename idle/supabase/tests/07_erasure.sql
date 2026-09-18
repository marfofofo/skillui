-- "IDLE" — App Store 5.1.1(v) and GDPR Art. 17 are the same button.
\echo '# ERASURE'
begin;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  luca   uuid := '33333333-3333-4333-8333-333333333333';
  v_code text;
  v_reports_before int;
begin
  -- Give luca something to lose: a terminal, a report against him, an edge.
  perform tests.as_user(luca);
  select c.code into v_code from public.create_pairing_code() c;
  perform public.pair_device(v_code, 'lucas-token-hash', 'lucas-laptop', null);
  perform public.record_heartbeat('lucas-token-hash', 'session_start', 'codex');

  perform tests.as_user(marcus);
  perform public.report_user(luca, 'spam', 'sent me the same link nine times', false);

  select count(*)::int into v_reports_before from public.reports;

  perform tests.eq(
    (select count(*)::int from tests.edges where who = 'luca' or friend = 'luca'),
    2,
    'luca has a friendship, in both directions');
  perform tests.eq(
    (select count(*)::int from tests.devices_raw where owner = 'luca'),
    1,
    'and a paired terminal');

  -- DELETE ------------------------------------------------------------------
  perform tests.as_user(luca);
  perform public.delete_account();

  perform tests.eq(
    (select count(*)::int from auth.users where id = luca),
    0,
    'the account is gone');
  perform tests.eq(
    (select count(*)::int from public.profiles where id = luca),
    0,
    'the profile is gone');
  perform tests.eq(
    (select count(*)::int from public.presence where user_id = luca),
    0,
    'the presence row is gone');
  perform tests.eq(
    (select count(*)::int from public.devices where user_id = luca),
    0,
    'every paired terminal and its token are gone');
  perform tests.eq(
    (select count(*)::int from public.friendships
      where user_id = luca or friend_id = luca),
    0,
    'both halves of every friendship are gone');
  perform tests.eq(
    (select count(*)::int from public.invite_codes where user_id = luca),
    0,
    'the invite code is gone');

  -- ...except the report, which survives with nobody attached to it.
  perform tests.eq(
    (select count(*)::int from public.reports),
    v_reports_before,
    'reports filed about the account survive, for abuse prevention');
  perform tests.eq(
    (select count(*)::int from public.reports where reported_id is not null),
    0,
    'but they no longer point at a person');
  perform tests.eq(
    (select count(*)::int from public.reports where reporter_id = luca),
    0,
    'and neither do reports the account filed');
end
$$;

rollback;
