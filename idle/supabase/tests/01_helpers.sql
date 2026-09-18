-- "IDLE" — assertions.

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.ok(condition boolean, label text)
returns void language plpgsql as $$
begin
  if condition then
    raise notice '  ok    %', label;
  else
    raise exception 'FAIL  %', label using errcode = 'P0001';
  end if;
end;
$$;

create or replace function tests.eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is not distinct from expected then
    raise notice '  ok    %', label;
  else
    raise exception 'FAIL  % (got %, expected %)', label, actual, expected
      using errcode = 'P0001';
  end if;
end;
$$;

/** Asserts that a statement is refused. Used for the column-level grants. */
create or replace function tests.denied(statement text, label text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAIL  % — it was ALLOWED', label using errcode = 'P0001';
exception
  when insufficient_privilege then
    raise notice '  ok    % (denied)', label;
  when others then
    if sqlerrm like 'FAIL%' then
      raise;
    end if;
    raise notice '  ok    % (refused: %)', label, sqlstate;
end;
$$;

/** Become a signed-in account, the way PostgREST does. */
create or replace function tests.as_user(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

create or replace view tests.people as
  select 'marcus'::text as handle, '11111111-1111-4111-8111-111111111111'::uuid as id
  union all select 'sofia',  '22222222-2222-4222-8222-222222222222'
  union all select 'luca',   '33333333-3333-4333-8333-333333333333'
  union all select 'giulia', '44444444-4444-4444-8444-444444444444';

grant select on tests.people to anon, authenticated, service_role;

-- Superuser-owned views, so a test can inspect the truth regardless of the
-- policies under test. Never created outside tests/.
create or replace view tests.codes as
  select p.handle::text as handle, c.code
  from public.invite_codes c join public.profiles p on p.id = c.user_id;

create or replace view tests.edges as
  select a.handle::text as who, b.handle::text as friend
  from public.friendships f
  join public.profiles a on a.id = f.user_id
  join public.profiles b on b.id = f.friend_id;

create or replace view tests.presence_raw as
  select p.handle::text as handle, pr.is_live, pr.agent,
         pr.session_started_at, pr.last_heartbeat_at
  from public.presence pr join public.profiles p on p.id = pr.user_id;

grant select on tests.codes, tests.edges, tests.presence_raw
  to anon, authenticated, service_role;

create or replace view tests.reports_raw as
  select r.id, r.reason, r.detail, r.resolved_at,
         rp.handle::text as reporter, tp.handle::text as reported,
         r.reporter_id, r.reported_id
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles tp on tp.id = r.reported_id;

create or replace view tests.devices_raw as
  select d.id, p.handle::text as owner, d.label, d.agent, d.revoked_at, d.last_seen_at
  from public.devices d join public.profiles p on p.id = d.user_id;

grant select on tests.reports_raw, tests.devices_raw to anon, authenticated, service_role;

/** Asserts that a statement raises, and that the message mentions `fragment`. */
create or replace function tests.raises(statement text, fragment text, label text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAIL  % — it did NOT raise', label using errcode = 'P0001';
exception
  when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if position(fragment in sqlerrm) > 0 then
      raise notice '  ok    % (raised %)', label, fragment;
    else
      raise exception 'FAIL  % — raised "%", expected "%"', label, sqlerrm, fragment
        using errcode = 'P0001';
    end if;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
