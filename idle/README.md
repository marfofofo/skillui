```
"IDLE"
```

> `"SOCIAL NETWORK"` FOR ENGINEERS · c/o 2026

The app is named after the state it exists to destroy.

You open `"IDLE"` to find out who is awake. Not who posted, not who liked, not
who is hiring — who is **in it right now**, at this hour, with an agent running.

```
MARCUS          c/o   CLAUDE CODE
SOFIA           c/o   CODEX
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  "IDLE"  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
LUCA            c/o   —
GIULIA          c/o   —
```

---

## HOW IT WORKS

You pair your terminal once:

```bash
npx idle link K4M-7QX
```

That writes a few lifecycle hooks into your Claude Code and Codex settings. From
then on, when you start a coding session your friends see your light come on, and
when you stop it goes out. Nothing else is sent — [see the protocol](docs/PRESENCE_PROTOCOL.md).

There is no feed. There is no posting. There are no follower counts. There are
people you actually know, and the two states a person can be in.

## THE DOOR

There is no "Sign in with Claude" — no such thing exists. So the door is the
terminal itself: you get in by pairing a real coding agent on a real machine.
You cannot bot your way into this network, and you cannot join it without being
someone who builds things.

That constraint is the product.

## GROWTH

You add a friend with a code, a link, or a QR code — you have to actually know
them. Then the graph does the rest: your friends' friends surface as suggestions
with the number of people you have in common, and the network densifies the way
a real community does, not the way a growth loop does.

---

## THIS REPOSITORY

| | |
|---|---|
| [`BRAND.md`](BRAND.md) | The design system. Read it before touching a pixel |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the three pieces fit together |
| [`docs/PRESENCE_PROTOCOL.md`](docs/PRESENCE_PROTOCOL.md) | Exactly what leaves your machine |
| [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) | What the App Store and Play require |
| `packages/agent/` | The CLI your coding agent's hooks call |
| `supabase/` | Postgres schema, row-level security, edge functions |
| `apps/mobile/` | The Expo app — iOS and Android |

## STACK

Expo (React Native) · Supabase (Postgres + Realtime + RLS) · Deno edge functions ·
a zero-dependency Node CLI.

## DEVELOPMENT

```bash
npm install                      # workspaces: agent + mobile
npx supabase start               # local postgres + edge runtime
npm run db:reset                 # apply migrations + seed
npm run mobile                   # expo start
npm test --workspace=idle-agent  # the CLI's privacy tests
```

---

`"README"`
