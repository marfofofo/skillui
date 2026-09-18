-- "IDLE" — who can see whom.
\echo '# VISIBILITY'
begin;
set local role authenticated;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  giulia uuid := '44444444-4444-4444-8444-444444444444';
begin
  perform tests.as_user(marcus);

  perform tests.eq(
    (select count(*)::int from public.presence),
    3,
    'you see presence for yourself and your two friends, and nobody else');

  perform tests.eq(
    (select count(*)::int from public.presence p where p.user_id = giulia),
    0,
    'a friend-of-a-friend''s presence is invisible');

  perform tests.eq(
    (select handle::text from public.profiles where id = giulia),
    null::text,
    'a friend-of-a-friend''s profile is invisible');

  perform tests.eq(
    (select count(*)::int from public.friends_with_presence()),
    2,
    'the list has two people on it');

  perform tests.eq(
    (select f.agent::text from public.friends_with_presence() f where f.handle = 'sofia'),
    'claude_code',
    'sofia is live, c/o CLAUDE CODE');

  perform tests.ok(
    (select f.is_live from public.friends_with_presence() f where f.handle = 'sofia'),
    'sofia''s row inverts');

  perform tests.ok(
    not (select f.is_live from public.friends_with_presence() f where f.handle = 'luca'),
    'luca sits under the hazard rule');
end
$$;

rollback;
