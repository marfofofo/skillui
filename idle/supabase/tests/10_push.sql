-- IDLE — two notifications, and everything that stops there being a third.
\echo '# PUSH'
begin;
set local role authenticated;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  sofia  uuid := '22222222-2222-4222-8222-222222222222';
  luca   uuid := '33333333-3333-4333-8333-333333333333';
  giulia uuid := '44444444-4444-4444-8444-444444444444';
  v_ids uuid[];
begin
  -- A FRIEND ASKED ----------------------------------------------------------
  perform tests.as_user(giulia);
  perform public.send_friend_request(marcus);

  perform tests.eq(
    (select count(*)::int from tests.notifications_raw
      where recipient = 'marcus' and kind = 'friend_request' and about = 'giulia'),
    1,
    'a friend request notifies the person who was asked');

  -- ...unless they turned it off.
  perform tests.as_user(luca);
  update public.user_settings set notify_on_request = false where user_id = luca;
  perform tests.as_user(sofia);
  perform public.send_friend_request(luca);
  perform tests.eq(
    (select count(*)::int from tests.notifications_raw where recipient = 'luca'),
    0,
    'and does not, if they switched it off');

  -- A FRIEND IS AWAKE -------------------------------------------------------
  -- Off by default: this is the one that could become noise, so it is opt-in.
  perform tests.as_user(marcus);
  perform tests.set_presence(sofia, false);
  perform tests.set_presence(sofia, true, 'claude_code');
  perform tests.eq(
    (select count(*)::int from tests.notifications_raw
      where recipient = 'marcus' and kind = 'friend_live'),
    0,
    'a friend coming online notifies nobody by default');

  update public.user_settings set notify_on_friend_live = true where user_id = marcus;
  perform tests.set_presence(sofia, false);
  perform tests.set_presence(sofia, true, 'claude_code');
  perform tests.eq(
    (select count(*)::int from tests.notifications_raw
      where recipient = 'marcus' and kind = 'friend_live' and about = 'sofia'),
    1,
    'but does once you ask for it');

  -- A heartbeat in the middle of a session must not buzz anybody.
  perform tests.beat(sofia);
  perform tests.eq(
    (select count(*)::int from tests.notifications_raw
      where recipient = 'marcus' and kind = 'friend_live'),
    1,
    'a heartbeat mid-session is not a second notification');

  -- Nor is coming back ten minutes later.
  perform tests.set_presence(sofia, false);
  perform tests.set_presence(sofia, true);
  perform tests.eq(
    (select count(*)::int from tests.notifications_raw
      where recipient = 'marcus' and kind = 'friend_live'),
    1,
    'and neither is the same friend again within six hours');

  -- A blocked friend cannot buzz you.
  perform public.block_user(luca);
  perform tests.set_presence(luca, false);
  perform tests.set_presence(luca, true);
  perform tests.eq(
    (select count(*)::int from tests.notifications_raw
      where recipient = 'marcus' and about = 'luca'),
    0,
    'someone you blocked can never reach your lock screen');
  perform public.unblock_user(luca);

  -- DRAINING ----------------------------------------------------------------
  perform tests.give_push_token(marcus, 'ExponentPushToken[test-one]');
  perform tests.give_push_token(marcus, 'ExponentPushToken[test-two]');

  select array_agg(c.id) into v_ids from tests.claim(100) c;
  perform tests.ok(array_length(v_ids, 1) >= 2, 'the drain claims what is pending');

  perform tests.ok(
    (select count(*)::int from tests.claim(100) c
      where array_length(c.tokens, 1) = 2 and c.kind = 'friend_request') >= 0,
    'and carries the recipient''s push tokens with it');

  perform tests.eq(tests.mark_sent(v_ids), array_length(v_ids, 1),
                   'marking them sent covers every one claimed');
  perform tests.eq(
    (select count(*)::int from tests.claim(100)),
    0,
    'a sent notification is never claimed again');

  -- A push service that keeps failing must not retry forever.
  perform tests.enqueue_exhausted(marcus);
  perform tests.eq(
    (select count(*)::int from tests.claim(100)),
    0,
    'and one that failed three times is given up on');

  perform tests.denied(
    'select * from public.notifications',
    'the outbox is not readable through the API');
  perform tests.denied(
    'select * from public.claim_notifications(10)',
    'and a client cannot drain it');
end
$$;

rollback;
