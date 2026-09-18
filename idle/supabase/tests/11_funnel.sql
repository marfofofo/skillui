-- IDLE — the drop-off that decides the product.
\echo '# FUNNEL'
begin;
set local role authenticated;

do $$
declare
  marcus uuid := '11111111-1111-4111-8111-111111111111';
  luca   uuid := '33333333-3333-4333-8333-333333333333';
  v jsonb;
  v_code text;
begin
  perform tests.as_user(marcus);

  v := tests.funnel();
  perform tests.eq((v ->> 'accounts')::int, 4, 'every real account is counted');
  perform tests.eq((v ->> 'paired_a_terminal')::int, 0, 'and none of them has paired yet');

  -- Someone asks for a code and never uses it: the leak we care about most.
  select c.code into v_code from public.create_pairing_code() c;
  v := tests.funnel();
  perform tests.eq((v ->> 'asked_for_a_code')::int, 1, 'asking for a code is a step');
  perform tests.eq((v ->> 'paired_a_terminal')::int, 0, 'and is not the same as finishing');
  perform tests.eq((v ->> 'codes_issued')::int, 1, 'the code is counted');
  perform tests.eq((v ->> 'codes_redeemed')::int, 0, 'and not as redeemed');

  -- Now they finish.
  perform tests.pair(v_code, 'funnel-token-hash', 'laptop');
  v := tests.funnel();
  perform tests.eq((v ->> 'paired_a_terminal')::int, 1, 'pairing moves them along');
  perform tests.eq((v ->> 'codes_redeemed')::int, 1, 'and redeems the code');
  perform tests.eq((v ->> 'ever_reported_a_session')::int, 0,
                   'but a paired terminal that never ran an agent is still a drop-off');

  perform tests.beat_device('funnel-token-hash', 'session_start', 'claude_code');
  v := tests.funnel();
  perform tests.eq((v ->> 'ever_reported_a_session')::int, 1, 'the first beat is the last step');
  -- Two: marcus, who just started, and sofia, who the seed leaves awake.
  perform tests.eq((v ->> 'live_now')::int, 2, 'and they are awake now');
  perform tests.ok((v ->> 'median_seconds_to_pair') is not null,
                   'and how long it took is measurable');

  perform tests.eq((v ->> 'has_a_friend')::int, 4, 'the seeded graph is counted separately');

  -- SIMULATED ACCOUNTS MUST NOT FLATTER THE NUMBERS ------------------------
  perform tests.make_demo(luca, 0, 60, 'codex');
  perform tests.eq(
    (tests.funnel() ->> 'accounts')::int,
    3,
    'a demo account is excluded, or every number here would be a lie');

  perform tests.denied(
    'select public.funnel()',
    'and the funnel is not something a client can read');
end
$$;

rollback;
