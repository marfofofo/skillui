# LAUNCH ROADMAP

Where the code actually is, and what stands between it and the App Store.

Status as written: **7,050 lines. 129 automated assertions passing. Zero lines
have ever run on a phone against a real backend.** Every estimate below is a
guess, and the first milestone is the one that will change all the others.

---

## THE HONEST SUMMARY

| | |
|---|---|
| **Built and tested** | Database schema, row-level security, the friend graph, presence state machine, contact matching, the agent CLI, all 17 screens, the design system |
| **Built, never executed** | The entire app. It typechecks; it has not launched |
| **Not built** | Push notifications, avatar upload, profile editing, data export, blocked-accounts list, deep links, the desktop app |
| **Does not exist yet** | A Supabase project, an Apple account, a Play account, the domain, a privacy policy, CI |

The riskiest assumption in the repository is that presence works end to end. It
is tested at the database level and at the CLI level, and the two have never met.

---

## M0 — IT RUNS

**The only milestone that matters right now.** Nothing else can be trusted until
a light goes on.

| | |
|---|---|
| Supabase project, EU region (`eu-central-1`), PITR on | **You** |
| Apply migrations + seed, deploy `pair` and `heartbeat` | Me |
| `.env` with the project URL and anon key | Me, once you have 1 |
| **A real email provider** (Resend or Postmark) wired to Supabase Auth | **You** + me |
| Apple Developer account → Sign in with Apple service id | **You** |
| EAS account, real `projectId`, first development build | **You** + me |
| Run on a physical phone. Claim a handle. Pair a real terminal | Me |
| GitHub Actions running the three suites on every push | Me |

**Exit criteria:** two phones, two terminals. One person starts Claude Code and
the other person's screen warms up. Nothing is real until that happens.

> **The email trap.** Supabase's built-in SMTP is a development convenience
> capped at a handful of messages per hour, and it fails *silently* — magic links
> simply never arrive and the user thinks the app is broken. This is the single
> most common way a launch like ours dies quietly. A real provider goes in at M0,
> not later.

**Estimate:** 1–2 sessions once the accounts exist. Most of the wall-clock is
waiting on Apple.

---

## M1 — THE GAPS THAT GET US REJECTED

Everything here is named in `COMPLIANCE.md` and not yet built.

| | Why |
|---|---|
| ~~**Reviewer demo account**~~ | **Done.** `supabase/demo.sql` seeds it; five friends on staggered schedules, so two are awake at any moment and the list changes while they watch |
| ~~**Data export** (GDPR Art. 20)~~ | **Done.** Settings → Your data → one file, and the file states what is *not* in it |
| ~~**Blocked accounts list + unblock**~~ | **Done.** Settings → Blocked |
| ~~**Profile editing**~~ | **Done.** Settings → Edit profile |
| **Web deletion URL** (`/delete`) | Play requires one reachable *without installing the app* |
| **Privacy policy, terms, support page** | Three live URLs. Referenced in seventeen places in the code as `idle.app`, which nobody owns |
| **Universal Links / App Links** | Configured and the `/i/[code]` route is built; needs the Team ID and the Android fingerprint filled in — `docs/UNIVERSAL_LINKS.md` |
| Fix the stale 1.2 table in `COMPLIANCE.md` | Report, block and contact info are built; the doc still says TODO |

**Exit criteria:** the pre-submission checklist in `COMPLIANCE.md` is green with
nothing hand-waved.

**Estimate:** 3–4 sessions, plus whatever the domain and the legal pages cost you.

---

## M2 — NOT FEELING BROKEN

Things a person will notice are missing within ten minutes.

| | |
|---|---|
| ~~**Push notifications**~~ | **Done.** Triggers fill an outbox, a scheduled function drains it to Expo. Two kinds only, capped at one per friend per six hours and five a day |
| **Avatar upload** | Storage bucket, RLS policy, image picker, resize on device |
| **Error reporting** (Sentry) | Right now, if heartbeats fail for a whole platform we find out from a tweet |
| **First-run path** | A new account has no friends and no terminal. The empty state is designed; the *journey out of it* is not |
| **Codex verified end to end** | The CLI writes the hooks; nobody has watched a real Codex fire one |
| **Funnel instrumentation** | Pairing a terminal is both our moat and our biggest drop-off. Measure it before optimising it |

**Exit criteria:** someone who is not us installs it cold and gets to a lit lamp
without asking us anything.

**Estimate:** 3–4 sessions.

---

## M3 — SHIP THE AGENT

| | |
|---|---|
| Publish `idle-agent` to npm | The name needs checking — it may be taken |
| Claude Code plugin marketplace repo + `/plugin install idle@idle` | Free distribution channel, and the nicest possible onboarding |
| `idle doctor` | Tells you why your light is not on. Will save every support email |

**Exit criteria:** `npx idle-agent link CODE` works on a machine that has never
seen this repo.

**Estimate:** 1 session.

---

## M4 — SUBMISSION

| | |
|---|---|
| Screenshots at every required size, description, keywords, age rating | |
| Privacy nutrition labels (Apple) + Data safety form (Play) | Must match `PRESENCE_PROTOCOL.md` and `CONTACTS.md` line by line |
| **A way to read the reports queue** | `reports` has no select grant by design. Moderation needs a real surface and a named human. The 24-hour SLA is a promise to Apple |
| `ROPA.md`, `INCIDENT.md` | Both marked TODO in `COMPLIANCE.md` |
| TestFlight → external testers → submit | |

**Exit criteria:** in review.

**Estimate:** 2 sessions, then Apple's clock.

---

## M5 — DESKTOP (TAURI)

Not a launch blocker, and the highest-leverage thing after launch.

IDLE belongs in the menu bar: glance up, see who is building, never open
anything. Tauri v2 gives a few-megabyte binary instead of Electron's hundred, and
the frontend shares the design system.

The reason to do it *early* rather than late: **it deletes the pairing step.** A
desktop user installs an app instead of running `npx idle-agent link`, which is
the single biggest drop-off in the funnel.

Recommendation: start it once iOS is in review, so it lands with the launch
rather than three months after.

**Estimate:** 3–4 sessions for a first working tray app.

---

## THE CRITICAL PATH

```
   M0 ─────────────▶ M1 ─────▶ M4 ─────▶ REVIEW
   (accounts)        (gaps)   (submit)
        │
        ├──▶ M2 (polish) ──┤
        └──▶ M3 (agent) ───┘
                  │
                  └──▶ M5 (desktop, parallel)
```

**What I need from you, in order of how much it blocks:**

1. **Supabase project**, EU region — blocks literally everything
2. **A domain.** `idle.app` is a placeholder in seventeen files. If it is taken,
   changing it costs minutes now and hours later
3. **Apple Developer** ($99/yr) and **Google Play** ($25 once)
4. **An email provider** account (Resend's free tier is fine to start)

Everything else I can do without you.

## WHAT I WOULD CUT IF WE WERE IN A HURRY

Honestly: nothing in M0 or M1. M2's avatar upload can go — a list of handles with
lamps next to them is a perfectly good product, and avatars are the kind of
feature that quietly brings a moderation burden with it. Suggestions and the
contact matching could both ship in an update rather than at launch; the code is
already written, so there is no reason to, but if a deadline appeared they are
the parts nobody would miss on day one.
