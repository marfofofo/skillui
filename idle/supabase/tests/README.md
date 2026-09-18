# `"IDLE"` — DATABASE TESTS

```bash
./run.sh
```

Applies the whole schema to a throwaway database and asserts what it should and
should not allow. **No Docker.** `00_bootstrap.sql` recreates the parts of the
Supabase platform the migrations assume — `auth.users`, `auth.uid()`, the
`anon`/`authenticated`/`service_role` roles, the realtime publication, and
crucially Supabase's *default privileges*, so the revokes in migration `000200`
are actually exercised rather than skipped.

Any PostgreSQL 15+ works:

```bash
initdb -D /tmp/idle-pg -U postgres --auth=trust
pg_ctl -D /tmp/idle-pg -o "-k /tmp/idle-sock -h ''" start
PGHOST=/tmp/idle-sock PGUSER=postgres ./run.sh
```

## THE SUITES

| | |
|---|---|
| `02_privacy` | The grants. `session_started_at` and `last_heartbeat_at` are unreachable by any signed-in account; so are device token hashes, the report queue and the rate limiter |
| `03_visibility` | Presence and profiles are friends-only; a friend-of-a-friend sees nothing |
| `04_graph` | Suggestions with mutual counts, invite codes, requests, reciprocal auto-accept, mirrored edges |
| `05_safety` | Reserved handles; blocking is total and silent; reporting blocks too |
| `06_device_api` | Pairing, single-use codes, heartbeats, revocation, the 8-minute decay, two terminals, rate limits |
| `07_erasure` | `delete_account()` removes everything and tombstones reports |

## WHY THIS EXISTS

The privacy claim in `../../docs/PRESENCE_PROTOCOL.md` §7 is not a policy we
promise to honour; it is a column grant that does not exist. `02_privacy.sql` is
what makes that true rather than aspirational — it asserts the *absence* of
access, so a future migration that widens a grant fails here before it ships.

It already caught one: `rate_limits`, created after the blanket revoke, had
inherited Supabase's default grant to every signed-in account.
