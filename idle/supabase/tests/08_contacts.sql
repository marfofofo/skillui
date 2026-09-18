-- IDLE — the address book never leaves the phone.
--
-- What these assert, in one line: nothing identifying about a person who is not
-- already a user can reach this database through the contact feature.

\echo '# CONTACTS'
begin;
set local role authenticated;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  sofia  uuid := '22222222-2222-4222-8222-222222222222';
  luca   uuid := '33333333-3333-4333-8333-333333333333';
  giulia uuid := '44444444-4444-4444-8444-444444444444';
  v_before int;
  v_sofia_hash text;
  v_luca_hash text;
  v_stranger_hash text;
  v_pepper text;
  v_found int;
begin
  -- The seed writes profiles directly, so give everyone their hash first.
  perform tests.as_user(sofia);  perform public.refresh_my_contact_hash();
  perform tests.as_user(luca);   perform public.refresh_my_contact_hash();
  perform tests.as_user(giulia); perform public.refresh_my_contact_hash();
  perform tests.as_user(marcus); perform public.refresh_my_contact_hash();

  perform tests.eq(
    (select count(*)::int from tests.contact_hashes_raw),
    4,
    'every account with a verified address has exactly one hash');

  -- THE HASH IS WHAT THE PHONE WOULD COMPUTE ------------------------------
  select public.contact_pepper() into v_pepper;
  perform tests.eq(
    (select ch.hash from tests.contact_hashes_raw ch where ch.handle = 'sofia'),
    encode(extensions.digest(v_pepper || 'sofia@idle.test', 'sha256'), 'hex'),
    'the server derives the same hash a phone would, from the verified address');

  -- AND ONLY FROM A VERIFIED ADDRESS --------------------------------------
  perform tests.set_auth_email(giulia, 'giulia@idle.test', false);
  perform tests.as_user(giulia);
  perform public.refresh_my_contact_hash();
  perform tests.eq(
    (select count(*)::int from tests.contact_hashes_raw where handle = 'giulia'),
    0,
    'an unconfirmed address never becomes a way to be found');
  perform tests.set_auth_email(giulia, 'giulia@idle.test', true);

  -- Apple's private relay is per-app and is in nobody's address book.
  perform tests.set_auth_email(giulia, 'abc123@privaterelay.appleid.com', true);
  perform public.refresh_my_contact_hash();
  perform tests.eq(
    (select count(*)::int from tests.contact_hashes_raw where handle = 'giulia'),
    0,
    'an Apple private relay address is not hashed, because it can never match');
  perform tests.set_auth_email(giulia, 'giulia@idle.test', true);
  perform public.refresh_my_contact_hash();

  -- STEP 1: BUCKETS ---------------------------------------------------------
  perform tests.as_user(marcus);
  select ch.hash into v_sofia_hash from tests.contact_hashes_raw ch where ch.handle = 'sofia';
  select ch.hash into v_luca_hash  from tests.contact_hashes_raw ch where ch.handle = 'luca';

  perform tests.eq(
    (select count(*)::int from public.contact_buckets(array[left(v_sofia_hash, 4)])
      where hash = v_sofia_hash),
    1,
    'a contact who is a user comes back in their bucket');

  perform tests.eq(
    (select count(*)::int from public.contact_buckets(
        array[left((select ch.hash from tests.contact_hashes_raw ch where ch.handle = 'marcus'), 4)])
      where hash = (select ch.hash from tests.contact_hashes_raw ch where ch.handle = 'marcus')),
    0,
    'you are never returned to yourself');

  -- Only four lowercase hex characters are accepted. Anything longer would
  -- start to identify a specific address to the server.
  perform tests.eq(
    (select count(*)::int from public.contact_buckets(array[v_sofia_hash])),
    0,
    'a full hash is not a valid bucket and matches nothing');
  perform tests.eq(
    (select count(*)::int from public.contact_buckets(array['ZZZZ', 'abc', 'abcde'])),
    0,
    'malformed prefixes are dropped rather than trusted');

  perform tests.raises(
    'select * from public.contact_buckets((select array_agg(lpad(to_hex(g), 4, ''0'')) from generate_series(1, 1001) g))',
    'too_many_prefixes',
    'a request cannot be larger than one pass over an address book');

  -- DISCOVERABILITY IS THE USER'S OWN SWITCH --------------------------------
  perform tests.as_user(luca);
  update public.user_settings set discoverable_by_contact = false where user_id = luca;
  perform tests.as_user(marcus);
  perform tests.eq(
    (select count(*)::int from public.contact_buckets(array[left(v_luca_hash, 4)])
      where hash = v_luca_hash),
    0,
    'someone who switched off discoverability is not returned');
  perform tests.as_user(luca);
  update public.user_settings set discoverable_by_contact = true where user_id = luca;
  perform tests.as_user(marcus);

  -- A BLOCK STILL HIDES YOU -------------------------------------------------
  perform public.block_user(luca);
  perform tests.eq(
    (select count(*)::int from public.contact_buckets(array[left(v_luca_hash, 4)])
      where hash = v_luca_hash),
    0,
    'a blocked account cannot be found through contacts either');
  perform public.unblock_user(luca);

  -- STEP 2: IDENTITY, ONLY FOR HASHES THAT ARE ALREADY USERS ----------------
  select count(*)::int into v_found
  from public.contact_matches(array[v_sofia_hash]) m
  where m.handle = 'sofia';
  perform tests.eq(v_found, 1, 'a matched hash resolves to a profile');

  perform tests.eq(
    (select m.relationship from public.contact_matches(array[v_sofia_hash]) m),
    'friend',
    'and says how you are already connected');

  v_stranger_hash := encode(extensions.digest(v_pepper || 'someone-not-here@example.com', 'sha256'), 'hex');
  perform tests.eq(
    (select count(*)::int from public.contact_matches(array[v_stranger_hash])),
    0,
    'the hash of someone who is not a user resolves to nothing at all');

  -- NOTHING ABOUT A NON-USER IS EVER WRITTEN --------------------------------
  select count(*)::int into v_before from tests.contact_hashes_raw;
  perform public.contact_buckets(array['0000', '1111', 'abcd']);
  perform public.contact_matches(array[v_stranger_hash]);
  perform tests.eq(
    (select count(*)::int from tests.contact_hashes_raw),
    v_before,
    'looking someone up never stores them');

  perform tests.denied(
    'select * from public.contact_hashes',
    'the hash table is not readable through the API');
  perform tests.denied(
    'select public.contact_hash(''anyone@example.com'')',
    'the server will not hash an arbitrary address on request');
  perform tests.denied(
    'select * from public.app_secrets',
    'the pepper is not readable as a row');
end
$$;

rollback;
