-- IDLE — the number that decides whether this product works.
--
-- Pairing a terminal is both the moat and the biggest drop-off in the funnel:
-- it is why nobody can bot their way in, and it is the step where people will
-- leave. LAUNCH.md says to instrument it before optimising it, so this measures
-- it from data the schema already holds — no analytics vendor, no event
-- pipeline, no third party receiving anything about anybody.

create or replace function public.funnel()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select p.id, p.created_at
    from public.profiles p
    -- Simulated accounts would flatter every number here.
    where not exists (select 1 from public.demo_accounts d where d.user_id = p.id)
  ),
  asked as (
    select distinct pc.user_id from public.pairing_codes pc
  ),
  paired as (
    select user_id, min(created_at) as first_paired_at
    from public.devices group by user_id
  ),
  ever_live as (
    select distinct d.user_id from public.devices d where d.last_seen_at is not null
  ),
  connected as (
    select distinct f.user_id from public.friendships f
  )
  select jsonb_build_object(
    'as_of', now(),
    'accounts', (select count(*) from people),
    -- The four steps, in the order a person meets them.
    'asked_for_a_code', (select count(*) from people p join asked a on a.user_id = p.id),
    'paired_a_terminal', (select count(*) from people p join paired pr on pr.user_id = p.id),
    'ever_reported_a_session', (select count(*) from people p join ever_live e on e.user_id = p.id),
    'has_a_friend', (select count(*) from people p join connected c on c.user_id = p.id),

    -- Where it actually leaks: codes handed out that were never redeemed.
    'codes_issued', (select count(*) from public.pairing_codes),
    'codes_redeemed', (select count(*) from public.pairing_codes where consumed_at is not null),
    'codes_expired_unused', (
      select count(*) from public.pairing_codes
      where consumed_at is null and expires_at < now()
    ),

    -- How long it takes the people who do get through.
    'median_seconds_to_pair', (
      select round(percentile_cont(0.5) within group (
        order by extract(epoch from (pr.first_paired_at - p.created_at))
      ))
      from people p join paired pr on pr.user_id = p.id
    ),
    'live_now', (
      select count(*) from public.presence pres
      join people p on p.id = pres.user_id
      where pres.is_live
    )
  );
$$;

-- Aggregate product data, not a client's business. service_role only: it is for
-- a dashboard query, and it never returns a row about an identifiable person.
revoke all on function public.funnel() from public, anon, authenticated;

comment on function public.funnel() is
  'Pairing funnel, computed from existing rows. Excludes demo accounts. Returns counts only — never an identifiable person.';
