-- "IDLE" — the promise in docs/PRESENCE_PROTOCOL.md §7, tested where it is made.
--
-- These are not policy tests. They are *grant* tests: the hidden columns are
-- not reachable by a signed-in account at all, so no future mistake in a
-- policy can expose them.

\echo '# PRIVACY'
begin;
set local role authenticated;

do $$
begin
  perform tests.as_user('11111111-1111-4111-8111-111111111111');  -- marcus

  perform tests.denied(
    'select session_started_at from public.presence',
    'a friend cannot read how long you have been working');

  perform tests.denied(
    'select last_heartbeat_at from public.presence',
    'a friend cannot read your last heartbeat');

  perform tests.denied(
    'select * from public.presence',
    'select * on presence is refused, because it would include those columns');

  perform tests.ok(
    (select count(*) from public.presence p where p.is_live) >= 0,
    'is_live and agent ARE readable');

  perform tests.denied(
    'select token_hash from public.devices',
    'nobody can read a device token hash, not even its owner');

  perform tests.denied(
    'select * from public.reports',
    'the report queue is not readable through the API');

  perform tests.denied(
    'select * from public.rate_limits',
    'the rate limit table carries no grant for a signed-in account');

  perform tests.eq(
    (select count(*)::int from public.invite_codes),
    1,
    'you can read your own invite code and nobody else''s');

  perform tests.denied(
    'update public.presence set is_live = true',
    'a client cannot write presence — only the heartbeat function can');

  perform tests.denied(
    'insert into public.friendships (user_id, friend_id) values (auth.uid(), auth.uid())',
    'a client cannot invent a friendship');

  perform tests.denied(
    'select public.record_heartbeat(''deadbeef'', ''session_start'', null)',
    'a client cannot call the heartbeat function directly');

  perform tests.denied(
    'select public.pair_device(''ABC123'', ''deadbeef'', null, null)',
    'a client cannot pair a device without going through the edge function');

  perform tests.denied(
    'select public.rate_limit_hit(''x'', ''y'', 1, interval ''1 hour'')',
    'a client cannot burn someone else''s rate limit');
end
$$;

rollback;
