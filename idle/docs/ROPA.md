# RECORD OF PROCESSING ACTIVITIES

GDPR Article 30. Written from the schema rather than from a template — every row
below names the table it describes, so it can be checked instead of believed.

> **To fill in before launch:** the controller's legal name, address and contact
> address. They are marked `[ ]` and are the only unknowns on this page.

---

## CONTROLLER

| | |
|---|---|
| Legal entity | `[ ]` |
| Establishment | `[ ]` (EU) |
| Contact for data protection | `[ ]` — must be a monitored address, published in the app and on the store listings |
| DPO | Not appointed. Art. 37 does not require one here: no large-scale monitoring, no special-category data. Revisit at 100,000 accounts, or the first time either of those changes |

---

## PROCESSING ACTIVITIES

### 1. Running an account

| | |
|---|---|
| Purpose | Letting a person have an identity on the service |
| Lawful basis | Art. 6(1)(b) — performance of a contract |
| Data subjects | Account holders |
| Categories | Email address (`auth.users`), handle, optional display name, optional 140-character bio, optional avatar URL (`profiles`) |
| Source | The person |
| Retention | Until deletion, which is immediate and self-service |
| Recipients | Supabase (processor). Nobody else |

### 2. Showing friends that you are building

| | |
|---|---|
| Purpose | The product |
| Lawful basis | Art. 6(1)(b) |
| Categories | **Current state only**: whether a session is running, and which agent (`presence.is_live`, `presence.agent`). Plus, server-side and never disclosed, when the current session started and when the last beat arrived |
| **Not** collected | Working directories, repository or branch names, prompts, model output, tool names, commands, diffs, file contents, or anything else from the hook payload. The agent reads stdin and discards it unparsed — `packages/agent/src/hook.js` |
| Retention | **No history exists.** The row is overwritten; when a session ends the fields are nulled. There is nothing to retain |
| Recipients | The account holder's accepted friends, and nobody else — enforced by column-level grants, not by application code (`supabase/migrations/20260918000200_rls.sql`) |

### 3. Paired terminals

| | |
|---|---|
| Purpose | Authenticating the machine that reports presence |
| Lawful basis | Art. 6(1)(b) |
| Categories | A device label the person chooses (defaults to the machine's hostname), the agent last seen, timestamps, and the **SHA-256 of a device token** (`devices`). The token itself is returned once and never stored |
| Retention | Until the device is revoked or the account is deleted |

### 4. The social graph

| | |
|---|---|
| Purpose | Friendships, requests, suggestions of people you have friends in common with |
| Lawful basis | Art. 6(1)(b) |
| Categories | Pairs of account identifiers and timestamps (`friendships`, `friend_requests`) |
| Retention | Until either party removes the friendship or deletes their account |

### 5. Finding friends from contacts

| | |
|---|---|
| Purpose | Telling a person which of their existing contacts already have an account |
| Lawful basis | Art. 6(1)(b), **for our own users only** |
| Categories | A salted SHA-256 of each **account holder's own verified email** (`contact_hashes`). Nothing else |
| **Third parties' data** | **None is processed.** Matching runs on the person's device. What reaches us is a set of 16-bit hash prefixes, each shared by an enormous number of possible addresses; the intersection is computed on the phone. Nothing identifying a non-user is ever transmitted, stored, or contacted — `docs/CONTACTS.md` |
| Retention | Until the account is deleted |

### 6. Notifications

| | |
|---|---|
| Purpose | Two messages: someone asked to be your friend, and — opt-in — a friend started building |
| Lawful basis | Art. 6(1)(b) for the first; **consent**, Art. 6(1)(a), for the second, which is off by default |
| Categories | Expo push tokens (`push_tokens`); an outbox row naming the recipient, the kind, and the handle it is about (`notifications`) |
| Recipients | Expo (processor) — the push token and the two words shown on the lock screen |
| Retention | Outbox rows deleted after 7 days; tokens until sign-out or deletion |

### 7. Abuse reports

| | |
|---|---|
| Purpose | Acting on reports within 24 hours, as the App Store requires |
| Lawful basis | Art. 6(1)(f) — legitimate interest in keeping the service safe. Balancing: the interest is safety, the data is minimal, and the subject's identity is removed as soon as it is no longer needed |
| Categories | Reporter, reported account, a reason from a fixed list, and up to 500 characters of optional free text (`reports`) |
| Retention | 12 months. **Survives account deletion with both identities set to null** — the row remains as a count, attached to nobody |

### 8. Rate limiting

| | |
|---|---|
| Purpose | Preventing enumeration and abuse of the pairing and contact endpoints |
| Lawful basis | Art. 6(1)(f) |
| Categories | A counter keyed by a **hash** of a device token or of an IP address (`rate_limits`). No readable address is stored |
| Retention | 24 hours |

---

## WHAT IS NOT PROCESSED AT ALL

Stated because the absence is the design, and an auditor should be able to check
it against the schema:

- No location of any kind.
- No advertising identifiers, no cross-app tracking, no ATT prompt because there
  is nothing to ask for.
- No third-party analytics SDK. The only product metric is `funnel()`, which
  counts rows already in the database and returns no identifiable person.
- No special-category data (Art. 9).
- No profiling and no automated decision-making with legal effect (Art. 22).
- No children's data: the minimum age is 16 in the EU, 13 where a member state
  has lowered it.

---

## PROCESSORS AND TRANSFERS

| Processor | What it handles | Where | Basis |
|---|---|---|---|
| Supabase | Database, auth, storage, edge functions | EU (`eu-central-1`) | DPA — `[ ]` signed |
| Expo | Push token → device, and the two words on the lock screen | US | DPA + SCCs — `[ ]` signed |
| Apple / Google | Delivery of the app; the push transport | US | Their standard terms |
| Vercel | Serving the web build (static files) | EU region to be selected | DPA — `[ ]` signed |

The email provider is `[ ]` and processes the address a magic link is sent to.

---

## SECURITY MEASURES (Art. 32)

- Row-level security on every table; the anon key is public by design and grants
  nothing on its own.
- **Column-level grants** carry the privacy promise: no signed-in account can read
  `presence.session_started_at` or `presence.last_heartbeat_at` by any query. This
  is a grant that does not exist, not a policy that could be misconfigured.
- Device tokens stored as SHA-256 only. A database dump cannot impersonate a terminal.
- Session tokens held in the device keychain (`expo-secure-store`), chunked around
  its item-size limit.
- Encrypted in transit throughout; encrypted at rest by the processor.
- 148 automated assertions run on every push, most of which assert the **absence**
  of access — so a future migration that widens a grant fails before it ships.

---

## REVIEW

Reviewed when a processing activity is added or changed, when a processor
changes, and at least annually. Last reviewed: on writing.
