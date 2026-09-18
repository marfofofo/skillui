-- "IDLE" — local development seed.
-- Four people, one graph, so the list screen has something to say on first run.
-- Never applied to staging or production.

do $$
declare
  v_ids uuid[] := array[
    '11111111-1111-4111-8111-111111111111'::uuid,  -- marcus  (you)
    '22222222-2222-4222-8222-222222222222'::uuid,  -- sofia   (friend, live)
    '33333333-3333-4333-8333-333333333333'::uuid,  -- luca    (friend, idle)
    '44444444-4444-4444-8444-444444444444'::uuid   -- giulia  (friend of sofia)
  ];
  v_handles text[] := array['marcus', 'sofia', 'luca', 'giulia'];
  v_names text[] := array['Marcus', 'Sofia', 'Luca', 'Giulia'];
  i int;
begin
  for i in 1 .. 4 loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_ids[i], 'authenticated', 'authenticated',
      v_handles[i] || '@idle.test',
      extensions.crypt('password123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    )
    on conflict (id) do nothing;

    insert into public.profiles (id, handle, display_name)
    values (v_ids[i], v_handles[i], v_names[i])
    on conflict (id) do nothing;

    insert into public.invite_codes (code, user_id)
    values (upper(substr(md5(v_handles[i]), 1, 8)), v_ids[i])
    on conflict (user_id) do nothing;

    insert into public.presence (user_id) values (v_ids[i])
    on conflict (user_id) do nothing;

    insert into public.user_settings (user_id) values (v_ids[i])
    on conflict (user_id) do nothing;
  end loop;

  -- marcus <-> sofia, marcus <-> luca, sofia <-> giulia
  -- so giulia surfaces to marcus as a suggestion with sofia in common.
  insert into public.friendships (user_id, friend_id) values
    (v_ids[1], v_ids[2]), (v_ids[2], v_ids[1]),
    (v_ids[1], v_ids[3]), (v_ids[3], v_ids[1]),
    (v_ids[2], v_ids[4]), (v_ids[4], v_ids[2])
  on conflict do nothing;

  -- One light on.
  update public.presence
     set is_live = true,
         agent = 'claude_code',
         session_started_at = now() - interval '12 minutes',
         last_heartbeat_at = now()
   where user_id = v_ids[2];
end
$$;
