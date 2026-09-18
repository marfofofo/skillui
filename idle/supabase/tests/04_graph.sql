-- "IDLE" — the graph: suggestions, invites, requests.
\echo '# GRAPH'
begin;
set local role authenticated;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  luca   uuid := '33333333-3333-4333-8333-333333333333';
  giulia uuid := '44444444-4444-4444-8444-444444444444';
  v_code text;
  v_result text;
  v_request uuid;
  v_row record;
begin
  -- SUGGESTIONS -------------------------------------------------------------
  perform tests.as_user(marcus);

  select * into v_row from public.suggested_friends(20) limit 1;
  perform tests.eq(v_row.handle, 'giulia', 'giulia is suggested to marcus');
  perform tests.eq(v_row.mutual_count, 1, 'one person in common');
  perform tests.eq(v_row.mutual_sample[1], 'sofia', 'and that person is sofia');

  perform tests.eq(
    (select count(*)::int from public.suggested_friends(20)),
    1,
    'your own friends are never suggested back to you');

  -- INVITES -----------------------------------------------------------------
  select code into v_code from tests.codes where handle = 'giulia';

  select lp.handle into v_result from public.lookup_invite(v_code) lp;
  perform tests.eq(v_result, 'giulia', 'an invite code resolves to a person');

  perform tests.eq(
    (select lp.relationship from public.lookup_invite(v_code) lp),
    'none',
    'and reports that you are not connected yet');

  perform tests.eq(
    (select count(*)::int from public.lookup_invite('ZZZZZZZZ')),
    0,
    'an unknown code resolves to nothing');

  perform tests.eq(
    (select count(*)::int from public.lookup_invite(lower(v_code))),
    1,
    'codes are case-insensitive and punctuation is ignored');

  -- REQUESTS ----------------------------------------------------------------
  select public.send_friend_request(giulia) into v_result;
  perform tests.eq(v_result, 'request_sent', 'marcus asks giulia');
  perform tests.eq(public.relationship_to(giulia), 'request_sent', 'and it shows as asked');

  select public.send_friend_request(giulia) into v_result;
  perform tests.eq(
    (select count(*)::int from public.friend_requests
      where sender_id = marcus and recipient_id = giulia and status = 'pending'),
    1,
    'asking twice does not create a second request');

  perform tests.as_user(giulia);
  select id into v_request from public.friend_requests
    where recipient_id = giulia and status = 'pending';
  select public.respond_friend_request(v_request, true) into v_result;
  perform tests.eq(v_result, 'friend', 'giulia accepts');

  perform tests.eq(
    (select count(*)::int from tests.edges
      where (who = 'marcus' and friend = 'giulia')
         or (who = 'giulia' and friend = 'marcus')),
    2,
    'the edge is written in both directions, always');

  -- RECIPROCAL REQUEST ------------------------------------------------------
  perform tests.as_user(luca);
  select public.send_friend_request(giulia) into v_result;
  perform tests.eq(v_result, 'request_sent', 'luca asks giulia');

  perform tests.as_user(giulia);
  select public.send_friend_request(luca) into v_result;
  perform tests.eq(v_result, 'friend', 'asking back is accepting');

  perform tests.eq(
    (select count(*)::int from tests.edges
      where (who = 'luca' and friend = 'giulia')
         or (who = 'giulia' and friend = 'luca')),
    2,
    'and it still writes both directions');

  -- SUGGESTIONS CLOSE -------------------------------------------------------
  perform tests.as_user(marcus);
  perform tests.eq(
    (select count(*)::int from public.suggested_friends(20)),
    0,
    'once you have added them, they stop being suggested');
end
$$;

rollback;
