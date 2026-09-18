# `idle-agent`

The thing your coding agent's lifecycle hooks call, so your friends see the
light come on.

```bash
npx idle-agent link K4M-7QX
```

Get the code from the `"IDLE"` app under `SETTINGS → "PAIR A TERMINAL"`.

---

## WHAT IT DOES TO YOUR MACHINE

`link` writes hook entries into `~/.claude/settings.json` and, if you have
Codex, `~/.codex/hooks.json`. It **merges** — your existing settings and your
own hooks are preserved, backed up to `<file>.idle-backup`, and every entry it
adds is `async` with a 5 second timeout so a hook can never slow a session down.

It stores a device token in `~/.idle/credentials.json`, mode `600`.

`unlink` removes exactly the entries it added and deletes the token.

## WHAT IT SENDS

Four fields, on session start, on each turn, and on session end:

```json
{ "event": "heartbeat", "agent": "claude_code", "client": "idle-agent/0.1.0", "nonce": "b7f3c1a0e94d" }
```

Your agent hands this process a JSON payload on stdin containing your working
directory, your transcript path, your prompts, your tool inputs and the model's
output. **It is drained and discarded without being parsed.** See
`src/hook.js` — the function is called `redactedRead`, it is nine lines long,
and `test/redaction.test.js` fails the build if a single byte of it reaches a
request body.

No file paths. No repository names. No prompts. No code. Not for how long, not
how intensely, not in what language.

## COMMANDS

| | |
|---|---|
| `idle link <CODE>` | pair this terminal |
| `idle status` | what is linked and when it last reported |
| `idle unlink` | remove the hooks, forget the token |

## ENVIRONMENT

| | |
|---|---|
| `IDLE_API_URL` | override the API base (local development) |
| `IDLE_HOME` | where credentials live (default `~/.idle`) |
| `CLAUDE_CONFIG_DIR` | where to find `settings.json` |
| `CODEX_HOME` | where to find `hooks.json` |
| `NO_COLOR` | plain output |

## DEPENDENCIES

None. Node 20+ and nothing else, on purpose: the supply chain of a package that
runs on every tool call should be exactly as long as Node itself.

## AS A CLAUDE CODE PLUGIN

```
/plugin marketplace add idle-app/marketplace
/plugin install idle@idle
```

The plugin installs the same five hooks without touching your settings file.
You still need to run `idle link <CODE>` once to pair.

---

`"README"`
