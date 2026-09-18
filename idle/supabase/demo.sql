-- IDLE — the account App Review signs in with.
--
-- Run this ONCE against the hosted project, from the SQL editor:
--   Supabase → SQL Editor → paste → Run
--
-- Why it has to exist: App Review cannot install Claude Code and pair a
-- terminal. Without a seeded account they open the app, see an empty list, and
-- reject under Guideline 4.2 — the likeliest rejection in the submission.
--
-- What they get: an account with five friends, two of whom are awake at any
-- moment and change every few minutes, so the product demonstrates itself.
--
-- Change REVIEWER_PASSWORD below before running, and put the same value in the
-- App Store Connect review notes.

do $$
declare
  reviewer_email    constant text := 'review@idle.app';
  reviewer_password constant text := 'REVIEWER_PASSWORD';

  reviewer uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  friends  uuid[] := array[
    'aaaaaaaa-0000-4000-8000-000000000002'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000003'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000004'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000005'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000006'::uuid
  ];
  handles  text[] := array['sofia', 'matteo', 'luca', 'giulia', 'davide'];
  -- Overlapping windows, so the list is never empty and never all lit.
  starts   int[]  := array[0, 12, 25, 38, 50];
  lengths  int[]  := array[22, 20, 24, 18, 20];
  agents   public.agent_kind[] := array[
    'claude_code', 'codex', 'claude_code', 'codex', 'claude_code'
  ];
  i int;
  uid uuid;
begin
  if reviewer_password = 'REVIEWER_PASSWORD' then
    raise exception 'Set a real reviewer password before running this.';
  end if;

  for i in 0 .. array_length(friends, 1) loop
    uid := case when i = 0 then reviewer else friends[i] end;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    values (
      '00000000-0000-0000-0000-000000000000', uid,
      'authenticated', 'authenticated',
      case when i = 0 then reviewer_email else handles[i] || '@demo.idle.app' end,
      extensions.crypt(
        case when i = 0 then reviewer_password else extensions.gen_random_uuid()::text end,
        extensions.gen_salt('bf')
      ),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    )
    on conflict (id) do nothing;

    insert into public.profiles (id, handle, display_name, bio)
    values (
      uid,
      case when i = 0 then 'reviewer' else handles[i] end,
      case when i = 0 then 'App Review' else initcap(handles[i]) end,
      case when i = 0 then null else 'Demo account for App Store review.' end
    )
    on conflict (id) do nothing;

    insert into public.invite_codes (code, user_id)
    values (upper(substr(md5(uid::text), 1, 8)), uid)
    on conflict (user_id) do nothing;

    insert into public.presence (user_id) values (uid) on conflict do nothing;
    insert into public.user_settings (user_id) values (uid) on conflict do nothing;

    -- The reviewer is a real account with a real (empty) presence row: they can
    -- pair a terminal if they want to. Only the friends are simulated.
    if i > 0 then
      insert into public.demo_accounts (user_id, live_from, live_to, agent)
      values (friends[i], starts[i], least(starts[i] + lengths[i], 60), agents[i])
      on conflict (user_id) do update
        set live_from = excluded.live_from,
            live_to = excluded.live_to,
            agent = excluded.agent;

      insert into public.friendships (user_id, friend_id) values
        (reviewer, friends[i]), (friends[i], reviewer)
      on conflict do nothing;
    end if;
  end loop;

  -- Two friendships among the friends, so "people you have in common" has
  -- something to suggest.
  insert into public.friendships (user_id, friend_id) values
    (friends[1], friends[2]), (friends[2], friends[1]),
    (friends[2], friends[3]), (friends[3], friends[2])
  on conflict do nothing;

  perform public.refresh_demo_presence();

  raise notice 'Reviewer account ready: % — five friends, presence on a schedule.', reviewer_email;
end
$$;
