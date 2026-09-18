# ARCHITECTURE

```
  ┌───────────────────┐         ┌───────────────────┐
  │   CLAUDE CODE     │         │      CODEX        │
  │  ~/.claude/       │         │  ~/.codex/        │
  │   settings.json   │         │   hooks.json      │
  └─────────┬─────────┘         └─────────┬─────────┘
            │  spawns `idle hook <event>` │
            └──────────────┬──────────────┘
                           ▼
                 ┌──────────────────────┐
                 │  packages/agent      │   reads stdin, THROWS IT AWAY,
                 │  the IDLE CLI        │   throttles, posts 4 fields
                 └──────────┬───────────┘
                            │  POST /functions/v1/heartbeat
                            │  Authorization: Bearer <device token>
                            │  { "event": "...", "agent": "..." }
                            ▼
        ┌────────────────────────────────────────────┐
        │             SUPABASE                       │
        │  ┌──────────────┐   ┌───────────────────┐  │
        │  │ edge funcs   │──▶│  postgres + RLS   │  │
        │  │ heartbeat    │   │  presence         │  │
        │  │ pair         │   │  friendships      │  │
        │  └──────────────┘   │  invite_codes     │  │
        │                     └─────────┬─────────┘  │
        │                     realtime  │            │
        └───────────────────────────────┼────────────┘
                                        ▼
                             ┌─────────────────────┐
                             │  apps/mobile        │
                             │  Expo · iOS + Play  │
                             └─────────────────────┘
```

---

## THE THREE PIECES

### 1. `packages/agent` — the CLI

An npm package (`idle`) plus a Claude Code plugin. Its only job is to be the
thing the coding agent's lifecycle hooks call.

- `idle link <CODE>` — pairs this terminal with an account. Writes hook config
  into `~/.claude/settings.json` and `~/.codex/hooks.json` by **merging**, never
  overwriting, and stores a device token in `~/.idle/credentials.json` (mode 600).
- `idle hook <event>` — what the hooks actually invoke. Reads stdin, discards it,
  and fires one throttled HTTPS request. Always exits 0. Always `async: true` so
  it can never slow down or block a coding session.
- `idle status` — prints what is linked and what was last sent.
- `idle unlink` — revokes the device server-side and removes the hook entries it
  installed (and only those).

See `docs/PRESENCE_PROTOCOL.md` for the wire format and the privacy guarantee.

### 2. `supabase` — the backend

Postgres with row-level security doing the actual access control, so a leaked
anon key exposes nothing. Two edge functions run with the service role because
they authenticate device tokens rather than user sessions:

- `pair` — exchanges a 6-character pairing code for a device token.
- `heartbeat` — validates a device token, updates one row in `presence`.

Everything else the app does goes straight to Postgres through RLS: no API layer
to keep in sync, no ORM, no server to scale.

**Presence is computed, not trusted.** A row says `live` only if
`last_heartbeat_at > now() - interval '8 minutes'`. A `pg_cron` job flips stale
rows every minute so that Realtime actually emits an UPDATE and friends' phones
see the light go out.

### 3. `apps/mobile` — the app

Expo + expo-router, one codebase for iOS and Android, EAS Build/Submit to ship to
both stores. Supabase Realtime subscription on the `presence` rows of your
friends; no polling, no background execution, no battery cost.

---

## WHY THIS SHAPE

**Why not "Sign in with Claude"?** It does not exist. There is no public OAuth
provider for Claude or Codex accounts. Pairing a terminal is not a workaround for
that — it is a better door. You cannot fake your way into `"IDLE"` by clicking a
button; you have to actually have a coding agent installed and running. That is
our `.edu` email address.

**Why hooks and not a daemon?** A background daemon is a process the user has to
trust, update, and remember. Hooks are configuration: they run only when the agent
runs, they cost nothing when it doesn't, and the user can read the entire
integration in ten lines of their own settings file.

**Why a command hook and not Claude Code's `type: "http"` hook?** An HTTP hook
would post the *entire* hook payload — `cwd`, `prompt_id`, tool inputs — to our
server. We would then have to promise to throw it away. Routing through our own
binary means the sensitive fields never leave the machine at all. The promise is
structural, not contractual.

---

## REPOSITORY LAYOUT

```
idle/
├── BRAND.md                    the design system
├── docs/
│   ├── ARCHITECTURE.md         this file
│   ├── PRESENCE_PROTOCOL.md    the wire format + privacy guarantee
│   └── COMPLIANCE.md           App Store / Play / GDPR requirements
├── packages/agent/             the CLI + Claude Code plugin
├── supabase/
│   ├── migrations/             schema, RLS, RPCs
│   └── functions/              pair, heartbeat
└── apps/mobile/                Expo app
```

## ENVIRONMENTS

| | Supabase project | App |
|---|---|---|
| `dev` | local `supabase start` | Expo Go |
| `staging` | hosted, seeded | TestFlight / Play internal testing |
| `prod` | hosted, PITR on | App Store / Play |

Secrets live in EAS secrets and Supabase project secrets. Nothing in the repo.
