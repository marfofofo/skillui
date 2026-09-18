# IDLE

> A small network of people who build at night.

The app is named after the state it exists to destroy.

```
  ●  sofia        CLAUDE CODE
  ●  matteo       CODEX
  ────────────────────────────
  ○  luca              —
  ○  giulia            —
```

You open IDLE to find out who is awake. Not who posted, not who liked, not who is
hiring — who is **in it right now**, at this hour, with an agent running.

There is no feed. There is no posting. There are no follower counts. There are
people you actually know, and the two states a person can be in.

---

## HOW IT WORKS

You pair your terminal once:

```bash
npx idle-agent link K4M-7QX
```

That writes a few lifecycle hooks into your Claude Code and Codex settings. From
then on, when you start a coding session your friends see your light come on, and
when you stop it goes out. Nothing else is sent — [see the protocol](docs/PRESENCE_PROTOCOL.md).

## THE DOOR

There is no "Sign in with Claude" — no such thing exists. So the door is the
terminal itself: you get in by pairing a real coding agent on a real machine.
You cannot bot your way into this network, and you cannot join it without being
someone who builds things.

That constraint is the product.

## GROWING

Four ways in, and not one of them can reach a stranger:

| | |
|---|---|
| A code, a link, a QR | You have to actually know them |
| Friends of friends | Ranked by how many people you have in common |
| Your contacts | Matched **on your device** — [the address book never leaves the phone](docs/CONTACTS.md) |
| — | There is no search box, and there never will be |

---

## THIS REPOSITORY

| | |
|---|---|
| [`BRAND.md`](BRAND.md) | The design system. Read it before touching a pixel |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the pieces fit together |
| [`docs/PRESENCE_PROTOCOL.md`](docs/PRESENCE_PROTOCOL.md) | Exactly what leaves your machine |
| [`docs/CONTACTS.md`](docs/CONTACTS.md) | How contact matching works without uploading contacts |
| [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) | What the App Store, Play and the GDPR require |
| [`docs/ROPA.md`](docs/ROPA.md) · [`docs/INCIDENT.md`](docs/INCIDENT.md) | The Art. 30 record, and what to do at 3am |
| [`docs/SETUP.md`](docs/SETUP.md) | **Pointing the code at the hosted project** |
| [`docs/LAUNCH.md`](docs/LAUNCH.md) | What stands between this and the App Store |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What comes next, and what never will |
| `packages/agent/` | The CLI your coding agent's hooks call |
| `supabase/` | Postgres schema, row-level security, edge functions |
| `apps/mobile/` | The Expo app — iOS and Android |

## STACK

Expo (React Native) · Supabase (Postgres + Realtime + RLS) · Deno edge functions ·
a zero-dependency Node CLI.

## DEVELOPMENT

```bash
npm install                      # workspaces: agent + mobile
./scripts/setup.sh               # link the hosted project, migrate, deploy
npm run mobile                   # expo start

npm test --workspace=idle-agent  # 35 CLI tests: privacy, settings merging, e2e
npm run db:test                  # 148 database assertions, no Docker needed
npm run test:loop                # the whole presence loop: terminal -> light
```

`npm run db:test` applies every migration to a throwaway PostgreSQL database and
asserts what the schema must refuse — see [`supabase/tests/`](supabase/tests/).

`npm run test:loop` is the one that matters most: it stands the real endpoints up
against the real schema and drives them with the real `idle` binary, so a light
actually comes on, stays on through a beat, goes out on `session-end`, and goes
out **by itself** when a terminal is unplugged. Everything else tests a piece;
this tests that the pieces meet.
