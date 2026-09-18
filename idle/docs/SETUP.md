# SETUP

Pointing the code at the hosted Supabase project.

The project is `rosqtabfzpopekfdimrn`. Its URL and publishable key are already in
`apps/mobile/.env.example` — **both are public by design.** They ship inside the
app bundle; row-level security is what protects the data, not their secrecy.

---

## ONE COMMAND

```bash
cd idle
npm install
./scripts/setup.sh
```

It links the project, applies all six migrations, and deploys both edge
functions. Safe to run again.

### Two corrections to the obvious sequence

**Do not run `supabase init`.** This repository already has `supabase/config.toml`
and `supabase/migrations/`. `init` exists to create those, and running it here
either fails or overwrites work.

**Do not paste the database password into a chat, an issue or a commit.** You do
not need to: `supabase link` prompts for it interactively, and the CLI stores it
locally. If you have already shared it anywhere, rotate it in
Settings → Database → Reset database password — it takes ten seconds and it is
the one credential in this project that actually matters.

---

## THE THREE THINGS THE CLI CANNOT DO

### 1. A real email provider — do this first

Supabase's built-in SMTP is a development convenience: a few messages an hour,
and when it hits the cap it **fails silently**. The magic link never arrives, the
person assumes the app is broken, and nothing anywhere logs an error.

Authentication → Emails → SMTP Settings. [Resend](https://resend.com)'s free tier
is enough to launch on.

### 2. The redirect URL

Authentication → URL Configuration → Redirect URLs: add `idle://auth-callback`.
Without it the magic link opens a browser and stops there.

### 3. pg_cron

Database → Extensions → enable `pg_cron`, then in the SQL editor:

```sql
select cron.schedule('idle-presence-sweep', '* * * * *',
                     'select public.sweep_presence()');
select cron.schedule('idle-pairing-code-sweep', '17 * * * *',
                     'select public.sweep_pairing_codes()');
select cron.schedule('idle-rate-limit-sweep', '23 * * * *',
                     'select public.sweep_rate_limits()');
```

The migrations try to schedule these and tolerate failure, because a project
without `pg_cron` should still get the schema. But without the first one, a
terminal that is killed or loses power **never goes dark** — its light stays on
for everyone, forever. It is the least obvious and most damaging thing to skip.

---

## SIGN IN WITH APPLE

Off in `config.toml` until the credentials exist, because pushing a
half-configured provider is worse than pushing none.

1. Apple Developer → Identifiers → Services ID for `app.idle.client`
2. Return URL: `https://rosqtabfzpopekfdimrn.supabase.co/auth/v1/callback`
3. Keys → new key with Sign in with Apple, download the `.p8`
4. Supabase → Authentication → Providers → Apple: paste the Services ID, Team ID,
   Key ID and the key contents
5. Set `enabled = true` under `[auth.external.apple]` in `supabase/config.toml`

Required on iOS as soon as any other third-party sign-in is offered.

---

## VERIFYING IT WORKS

```bash
cd apps/mobile && npx expo start
```

Then, end to end — this is the check that has never been run, and the only one
that matters:

1. Sign in, claim a handle
2. Settings → Pair a terminal, take the six-character code
3. On a machine with Claude Code: `npx idle-agent link <CODE>`
4. Start a Claude Code session
5. Your own lamp lights, and the room warms up

If step 5 does not happen, in order: `idle status` on the machine, then the
`heartbeat` function's logs in the dashboard, then `select * from presence` in
the SQL editor.

---

## THE WEB BUILD (VERCEL)

Expo exports the same app as a static site, so the whole product can be used in a
browser **today** — no Apple account, no TestFlight, no review. It is the fastest
way to get to the one check that has never been run.

**It is the real app, not a demo.** Sign-in, the pairing code, the list, presence
over Realtime: all of it works. You pair a terminal from the browser exactly as
you would from the phone, because the pairing happens on the machine.

### Deploying

New Vercel project from this repository, then:

| Setting | Value |
|---|---|
| Root Directory | `idle/apps/mobile` |
| Include files outside the root directory | **on** (it is an npm workspace) |
| Framework Preset | Other |
| Environment variables | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the values in `.env.example`, both public |

Everything else is in `apps/mobile/vercel.json`: the install runs at the workspace
root, the build is `expo export`, and every path rewrites to `index.html` because
expo-router is a single-page app and a hard refresh on `/settings` would 404
without it.

Then add the deployment URL to Supabase → Authentication → URL Configuration →
Redirect URLs, or the magic link will bounce.

### What does not work in a browser, and why

| | |
|---|---|
| Sign in with Apple | iOS only. The button is hidden on web |
| Contacts | There is no address book in a browser. The entry point is hidden rather than shown broken |
| Push notifications | Not built yet on any platform |
| QR scanning | Needs camera permission over HTTPS; works on a deployed URL, not on `http://localhost` |

Two web-only differences are handled in the code rather than worked around:
the magic link returns to `window.location.origin` instead of `idle://`, and the
grain is drawn with an SVG turbulence filter because react-native-web ignores
`resizeMode="repeat"` and silently draws one tile in the corner.

---

## LOCAL DEVELOPMENT

The hosted project is not needed to work on the schema:

```bash
npm run db:test    # applies every migration to a throwaway database, 101 assertions
```

It needs only a PostgreSQL 15+ binary — no Docker, no network. See
[`supabase/tests/README.md`](../supabase/tests/README.md).
