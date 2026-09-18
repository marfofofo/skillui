-- "IDLE" — App Store Guideline 1.2: blocking is total, and silent.
\echo '# SAFETY'
begin;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
        '55555555-5555-4555-8555-555555555555',
        'authenticated', 'authenticated', 'newbie@idle.test', now(), now());

set local role authenticated;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  sofia  uuid := '22222222-2222-4222-8222-222222222222';
  luca   uuid := '33333333-3333-4333-8333-333333333333';
  newbie uuid := '55555555-5555-4555-8555-555555555555';
  v_code text;
begin
  -- RESERVED HANDLES --------------------------------------------------------
  perform tests.as_user(newbie);
  perform tests.raises(
    'select public.claim_handle(''admin'')',
    'handle_reserved',
    'reserved handles are refused at write time');

  perform tests.ok(
    (select public.claim_handle('newbie')).handle = 'newbie',
    'an ordinary handle is fine');

  -- BLOCKING ----------------------------------------------------------------
  perform tests.as_user(marcus);
  perform tests.eq(public.relationship_to(luca), 'friend', 'marcus and luca start as friends');

  perform public.block_user(luca);

  perform tests.eq(
    (select count(*)::int from tests.edges
      where (who = 'marcus' and friend = 'luca') or (who = 'luca' and friend = 'marcus')),
    0,
    'blocking deletes the friendship in both directions');

  perform tests.eq(public.relationship_to(luca), 'blocked', 'and marcus sees it as blocked');

  -- WHAT THE BLOCKED PERSON SEES: nothing, and no signal that they were blocked.
  perform tests.as_user(luca);

  perform tests.eq(
    (select count(*)::int from public.profiles where id = marcus),
    0,
    'the blocked account cannot read the blocker''s profile');

  perform tests.eq(
    (select count(*)::int from public.presence where user_id = marcus),
    0,
    'nor their presence');

  perform tests.eq(
    (select count(*)::int from public.blocks),
    0,
    'nor that a block exists at all');

  select code into v_code from tests.codes where handle = 'marcus';
  perform tests.eq(
    (select count(*)::int from public.lookup_invite(v_code)),
    0,
    'the blocker''s invite code behaves exactly like an unknown code');

  perform tests.raises(
    'select public.send_friend_request(''11111111-1111-4111-8111-111111111111'')',
    'no_such_person',
    'and a request back is refused with the same error as a missing account');

  -- REPORTING ---------------------------------------------------------------
  perform tests.as_user(sofia);
  perform public.report_user(luca, 'harassment', 'made it weird', true);

  perform tests.eq(
    (select count(*)::int from tests.reports_raw
      where reporter = 'sofia' and reported = 'luca' and reason = 'harassment'),
    1,
    'a report is filed');

  perform tests.eq(
    (select count(*)::int from tests.edges
      where (who = 'sofia' and friend = 'luca') or (who = 'luca' and friend = 'sofia')),
    0,
    'reporting also blocks, so the edge goes too');

  perform tests.raises(
    'select public.report_user(''22222222-2222-4222-8222-222222222222'', ''spam'')',
    'cannot_report_self',
    'you cannot report yourself');
end
$$;

rollback;
