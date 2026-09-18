# ROADMAP

The product is finished when there is nothing left to remove. This is the order
in which things get added anyway, and the reasons one would stop.

---

## V1 — `"WHO IS AWAKE"`

Everything in this repository. One list, two states, a graph you can only enter
by knowing someone.

**Ships when:** the pre-submission checklist in `COMPLIANCE.md` is green.

**The bar:** a person opens the app, sees a friend's row inverted, and feels the
thing Facebook felt like in 2005 — that there is a small world in here and they
are in it.

---

## V1.1 — CODEX PARITY AND THE PLUGIN

- Codex hook installation verified end to end (the CLI writes it today; the
  `codex_hooks` feature flag and hook-trust path need testing against a real
  install).
- The Claude Code plugin published to a marketplace, so onboarding is
  `/plugin install idle@idle` and one `idle link`.
- `idle doctor` — tells you why your light is not on.

---

## V2 — `"KNOCK"`

The one interaction the product earns the right to add.

You see a friend is awake. You tap their row. They get a single notification:
your handle, nothing else. No message, no thread, no inbox. They either come
find you or they don't.

**Why this and not chat:** chat makes the app a place you have to keep up with.
A knock is a doorbell. It costs the sender nothing and the receiver one glance.
It is the only feature that turns "I can see you are working" into "we are
working together", and it does it without creating content.

**The constraint that makes it work:** one knock per friend per hour, no
delivery receipts, no knock history. If we ever show who knocked at you and
didn't get a reply, we have built guilt.

---

## V3 — `"TOGETHER"`

A room, not a feed. Two or more friends who are both awake are, without doing
anything, shown as a pair on each other's list:

```
MARCUS + SOFIA     c/o   CLAUDE CODE + CODEX
```

That's the whole feature. Coworking presence with no video, no audio, no screen
share, no scheduling. The product's only claim is that you are not alone at 2am,
and this is the strongest possible version of that claim.

---

## PERMANENTLY OFF THE TABLE

Written down so a growth deck cannot quietly reintroduce them.

| | Why not |
|---|---|
| A feed | There is no content. Adding some would make this a different product |
| Streaks, XP, leaderboards | Turns building into a game you can lose |
| Public profiles / follower counts | The moment there is a number on a person, the network optimises for it |
| Duration and intensity by default | We decided what a friend sees, and it is `agent` and nothing else |
| Repo and language in presence | Kills adoption in any company with an NDA, and it is the first thing a screenshot leaks |
| Recruiter tooling | The instant this becomes a hiring surface, nobody sets their status honestly |
| Ads | — |

---

## THE OPEN QUESTIONS

Honest ones, not rhetorical.

1. **Does the terminal pairing step kill the funnel?** It is our moat and our
   biggest drop-off. Instrument it before optimising it.
2. **What happens in a dead network?** A list with three idle friends is a sad
   object. The empty state is designed; the near-empty state is not, yet.
3. **Timezones.** "Who is awake" is a different product for a person whose
   friends are eight hours away. Possibly the most interesting unsolved thing here.
4. **Teams.** The obvious revenue line is a company buying this for its engineers.
   It is also the fastest way to turn presence into surveillance. If it ever
   ships, the employer must see strictly less than a friend does, not more.
