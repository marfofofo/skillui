-- IDLE — the export, the blocked list, and the reviewer's account.
\echo '# M1'
begin;
set local role authenticated;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  sofia  uuid := '22222222-2222-4222-8222-222222222222';
  luca   uuid := '33333333-3333-4333-8333-333333333333';
  v_export jsonb;
  v_code text;
begin
  -- EXPORT ------------------------------------------------------------------
  perform tests.as_user(marcus);
  select public.export_my_data() into v_export;

  perform tests.eq(v_export -> 'profile' ->> 'handle', 'marcus', 'the export names you');
  perform tests.eq(v_export -> 'account' ->> 'email', 'marcus@idle.test',
                   'and the address the account was opened with');
  perform tests.eq(
    jsonb_array_length(v_export -> 'friends'), 2,
    'and every friendship');
  perform tests.ok(
    v_export -> 'friends' @> '[{"handle": "sofia"}]'::jsonb,
    'by handle');
  perform tests.ok(
    jsonb_array_length(v_export -> 'not_held') = 4,
    'and states in the document itself what is NOT held');

  -- The promise of PRESENCE_PROTOCOL.md §7, checked against the export: there
  -- is no history of when anyone was awake, because none is kept.
  perform tests.ok(
    v_export -> 'presence_now' ? 'is_live' and not (v_export ? 'presence_history'),
    'presence exports as one current state, never as a history');

  perform tests.ok(
    (v_export ->> 'invite_code') is not null,
    'the export includes your invite code');

  -- It is yours and only yours: nothing here can be made to describe sofia.
  perform tests.as_user(sofia);
  perform tests.eq(
    (select public.export_my_data() -> 'profile' ->> 'handle'),
    'sofia',
    'each caller gets their own export and no one else''s');

  -- BLOCKED LIST ------------------------------------------------------------
  -- Note the order: this runs after the export, because blocking DELETES the
  -- friendship and would change what there was to export.
  perform tests.as_user(marcus);
  perform public.block_user(luca);

  perform tests.eq(
    (select count(*)::int from public.profiles where id = luca),
    0,
    'a blocked person is hidden from your ordinary reads, as designed');

  perform tests.eq(
    (select b.handle from public.my_blocks() b),
    'luca',
    'but the blocked list can still name them, or you could never undo it');

  perform public.unblock_user(luca);
  perform tests.eq(
    (select count(*)::int from public.my_blocks()),
    0,
    'and unblocking empties it');

  -- THE REVIEWER'S ACCOUNT --------------------------------------------------
  perform tests.eq(
    (select public.refresh_demo_presence()),
    0,
    'with no demo accounts the refresh is a no-op');

  perform tests.make_demo(luca, 0, 60, 'codex');

  perform tests.eq(
    (select public.refresh_demo_presence()),
    1,
    'a demo account is driven on a schedule instead of by a heartbeat');
  perform tests.ok(
    (select is_live from tests.presence_raw where handle = 'luca'),
    'so App Review sees a light without pairing a terminal');
  perform tests.eq(
    (select agent::text from tests.presence_raw where handle = 'luca'),
    'codex',
    'with the agent the demo declares');

  -- And the sweep must not put it out from under them.
  perform public.sweep_presence();
  perform tests.ok(
    (select is_live from tests.presence_raw where handle = 'luca'),
    'and the 8-minute sweep never switches a demo account off');

  -- Outside its window it goes dark, so the list actually changes while they watch.
  perform tests.make_demo(luca, 0, 0, 'codex');
  perform public.refresh_demo_presence();
  perform tests.ok(
    not (select is_live from tests.presence_raw where handle = 'luca'),
    'outside its window the demo lamp goes out');

  perform tests.denied(
    'select * from public.demo_accounts',
    'the demo table is not readable through the API');
end
$$;

rollback;
