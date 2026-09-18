# INCIDENT RUNBOOK

What to do when something has gone wrong, written before it has, because the
72-hour clock in Art. 33 starts when you *become aware* — not when you finish
understanding.

> **To fill in before launch:** the on-call contact and the supervisory
> authority's reporting URL. Marked `[ ]`.

---

## THE FIRST HOUR

Do these in order. Do not investigate first.

1. **Write down the time you became aware.** The clock starts there, and it is
   the first thing a regulator asks for.
2. **Stop the bleeding.** If a credential leaked, rotate it now — before you
   understand how. The commands are at the bottom of this page.
3. **Do not delete anything.** Not logs, not rows, not the offending deploy. You
   will need them, and destroying evidence turns an incident into a finding.
4. **Open a file** in a private repository: what you saw, when, and what you did.
   Append to it as you go. This becomes the Art. 33(5) record whether or not the
   breach is reportable.

---

## WHAT COUNTS AS A BREACH HERE

Ranked by how bad it actually is for a person, which is not the same as how
dramatic it looks.

| | Severity | Why |
|---|---|---|
| The **service role key** leaks | **Critical** | It bypasses row-level security entirely. Everything below follows from it |
| The **database** is exfiltrated | **Critical** | Emails, handles, the friend graph, and every contact hash |
| A **device token** leaks | Low | It authorises exactly one thing: writing its owner's presence. It cannot read a friend, a profile or anything else |
| The **contact pepper** leaks | Low | It is not a secret and never was — it ships in the app. Losing it raises nothing, because nothing depended on it being hidden |
| The **anon / publishable key** leaks | **Not a breach** | It is public by design, ships in the app bundle, and grants nothing without RLS allowing it |
| A **migration widens a grant** | Serious | The most likely real incident: not an attacker, a mistake. This is what the 148 assertions exist to catch |

**The one to think hardest about** is a leak of presence timing —
`session_started_at` and `last_heartbeat_at`. No account can read them, but the
service role can, and together they are a record of when a person was awake. That
is the most intimate thing in this database, and it is why those two columns have
no grant rather than a policy.

---

## DECIDING WHETHER TO REPORT

Art. 33: notify the supervisory authority **within 72 hours** unless the breach is
unlikely to result in a risk to people's rights and freedoms. Art. 34: notify the
**people themselves**, without undue delay, when the risk is high.

Two working rules:

- **When unsure, report.** A late notification is a fine; an unnecessary one is a
  form.
- **A device token or the pepper alone is not reportable.** Document the reasoning
  in the file and move on. Anything touching `auth.users`, `profiles`, the graph,
  `contact_hashes` or the presence timing columns is.

Notify people in the app and by email, in plain language: what happened, what it
means for them, what we have done, and what they should do. Never "an incident
involving a third-party vendor" when the honest sentence is "someone could read
your email address".

---

## CONTAINMENT, BY CAUSE

### Service role key leaked
```
supabase projects api-keys --project-ref rosqtabfzpopekfdimrn
# rotate in the dashboard: Settings -> API -> service_role -> Reset
supabase secrets set IDLE_CRON_SECRET="$(openssl rand -hex 24)"
supabase functions deploy pair heartbeat notify --no-verify-jwt
```
Then reset the database password, and assume everything readable was read.

### A grant is wider than it should be
```
npm run db:test          # find out which assertion should have caught it
```
Write the failing assertion **first**, then the migration that fixes it. A fix
without a test is the same incident scheduled for later.

### A device is being abused
```sql
update public.devices set revoked_at = now() where id = '<device id>';
```
Immediate: `record_heartbeat` refuses a revoked device on the next beat.

### An account is being abused
The report queue is the input. `block_user` is per-person and immediate; for
removal, `delete_account()` run as that user, which leaves the reports behind
with the identity stripped.

---

## AFTER

Within a week, write down:

- The sequence, in times.
- **The assertion that would have caught it** — and add it. Every incident here
  should end with a test, because the ones that do not repeat.
- Whether the `ROPA.md` entry for the affected activity was accurate. If the
  incident touched data the record does not mention, the record is the bug.

---

## CONTACTS

| | |
|---|---|
| On-call | `[ ]` |
| Supervisory authority | `[ ]` — the one for the establishment in `ROPA.md` |
| Supabase support | Dashboard → Support, and the status page |
| Deadline | **72 hours from awareness**, not from understanding |
