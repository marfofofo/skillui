# PRESENCE PROTOCOL

The contract between a terminal and `"IDLE"`. It is deliberately tiny, and it is
the most important document in this repository: everything the product is allowed
to know about you is on this page.

---

## 1 — WHAT IS SENT

Exactly four fields. There is no fifth field, and adding one is a breaking change
that requires re-consent in the app.

```json
{
  "event": "session_start",
  "agent": "claude_code",
  "client": "idle-agent/0.1.0",
  "nonce": "b7f3c1a0e94d"
}
```

| Field | Values | Why it exists |
|---|---|---|
| `event` | `session_start` · `heartbeat` · `session_end` | Drives the state machine |
| `agent` | `claude_code` · `codex` | The `c/o` line in the UI |
| `client` | agent version string | So we can deprecate old clients |
| `nonce` | random hex | Replay protection, 10-minute window |

Identity comes from the `Authorization: Bearer <device_token>` header. The body
carries no identity at all.

## 2 — WHAT IS NEVER SENT

The hook payload handed to us on stdin by Claude Code contains `cwd`,
`transcript_path`, `prompt_id`, `permission_mode`, `tool_name`, `tool_input`,
`tool_output` and `last_assistant_message`.

**The CLI reads stdin and discards it without parsing it.** None of the following
ever leaves the machine:

- No file paths, no working directory, no repository or project name
- No prompts, no model output, no transcript, not one byte of source code
- No tool names, no commands, no diffs
- No branch names, no git remotes
- No IP-derived location, no device fingerprint beyond the token you created

This is enforced in one function, `redactedRead()`, in `packages/agent/src/hook.js`,
and it is covered by a test that fails if any stdin content reaches the request body.

## 3 — THE STATE MACHINE

```
                 session_start / heartbeat
                ┌──────────────────────────┐
                ▼                          │
   ┌────────┐                        ┌──────────┐
   │  IDLE  │                        │   LIVE   │
   └────────┘                        └──────────┘
        ▲                                  │
        └──────────────────────────────────┘
           session_end, OR no heartbeat
           for 8 minutes (server-side sweep)
```

There is no "away", no "busy", no "do not disturb". Two states. A person is
either building or they are not.

### Heartbeat sources

| Agent | Hook events wired | Cadence in practice |
|---|---|---|
| Claude Code | `SessionStart`, `UserPromptSubmit`, `Stop`, `PreToolUse`, `SessionEnd` | Every prompt, every turn, and throttled during long tool runs |
| Codex | `SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd` | Every prompt and turn |

`PreToolUse` fires constantly, so the CLI throttles locally: it will not send more
than one heartbeat per **90 seconds**, writing the last-sent timestamp to
`~/.idle/state.json`. A long agent run therefore produces a steady trickle instead
of a flood, and a crashed terminal decays to idle on its own within 8 minutes.

All hooks are registered with `async: true` and `timeout: 5`. A hook that fails,
hangs, or has no network **never** affects the coding session. The CLI exits 0
unconditionally.

## 4 — DEVICE TOKENS

- Generated server-side in the `pair` edge function: 32 random bytes, base64url.
- Stored on the server as **SHA-256 only**. A database dump cannot impersonate a
  terminal.
- Stored on the client in `~/.idle/credentials.json` with mode `600`.
- Scoped to one device. Revocable individually from the app (`"DEVICES"` screen)
  and revoked in bulk on account deletion.
- A token authorises exactly one thing: writing your own presence row. It cannot
  read your friends, your profile, or anything else.

## 5 — PAIRING

```
  APP                          SERVER                        TERMINAL
   │                              │                              │
   │── request code ─────────────▶│                              │
   │◀── "K4M-7QX", ttl 10 min ────│                              │
   │                              │                              │
   │  user types it in terminal ──┼────── idle link K4M-7QX ────▶│
   │                              │◀── POST /pair {code} ────────│
   │                              │── device_token ─────────────▶│
   │◀── realtime: device linked ──│                              │
```

The code is 6 characters from an unambiguous alphabet (no `0/O`, no `1/I/L`),
single-use, 10-minute TTL, rate-limited to 5 issued codes per user per hour and
10 redemption attempts per IP per hour.

## 6 — RATE LIMITS

| Endpoint | Limit |
|---|---|
| `heartbeat` | 60 / hour / device (throttle makes the real rate ~40) |
| `pair` | 10 / hour / IP |
| invite redemption | 20 / day / account |
| friend requests sent | 50 / day / account |

Exceeding a limit returns `429` and the CLI silently backs off. It never retries
in a loop and never blocks.

## 7 — WHAT A FRIEND SEES

Per the product decision, the default and only presence disclosure is:

```
MARCUS          c/o   CLAUDE CODE
```

Your friends see **that you are building and which agent you are using**. They do
not see for how long, how intensely, in what language, or on what project. The
server stores `session_started_at` because the state machine needs it; it is never
exposed through any view, RPC, or API reachable by another account.

If richer presence is ever added it ships as an explicit per-session opt-in with a
visible indicator, never as a default, and never retroactively.
