# FINDING FRIENDS FROM YOUR CONTACTS

Without your contacts leaving your phone.

---

## THE PROBLEM WITH THE NORMAL WAY

Matching an address book against a user base normally means uploading the address
book. That is processing the personal data of people who are **not users and never
consented**, and the sender's consent cannot stand in for theirs.

This is not theoretical. The Belgian DPA fined the social network Twoo **€50,000**
for exactly this: its "tell a friend" feature processed the data of people who
appeared in members' address books but were not members themselves. Apple rejects
the same pattern under Guideline 5.1.2 — collecting information about the user's
contacts without those people's knowledge or consent.

We are established in the EU. This would be the single largest legal exposure in
the product, and it would contradict the sentence the whole thing is built on.

---

## WHAT WE DO INSTEAD

Two steps, and the server never receives a full identifier for anyone who is not
already a user.

```
  PHONE                                        SERVER
    │
    │  hash every address in the address book
    │  locally: sha256(pepper + address)
    │
    │── the first 4 hex characters of each ───▶│
    │   one of 65,536 buckets, shared by an    │  look up REGISTERED users
    │   enormous number of addresses           │  whose hash starts that way
    │                                          │
    │◀── the full hashes of those users ───────│  (no names, no identity)
    │
    │  intersect the two sets HERE, on the phone
    │
    │── only the hashes that MATCHED ─────────▶│  these belong to people who
    │   (i.e. people already on IDLE)          │  are already users
    │                                          │
    │◀── their handles ────────────────────────│
    │
  show the matches
```

So:

- **The address book never leaves the device.** What is transmitted is a set of
  16-bit buckets, which identify nobody.
- **Nothing about a non-user is stored.** A lookup writes no row; a test asserts
  the table's size is unchanged after one.
- **Nothing is ever sent to a non-user.** There is no invite flow, no "your friend
  Marcus is waiting for you" email, no SMS. This is the part that actually got
  Twoo fined, and we simply do not have the feature.

## THE DETAILS THAT MATTER

**Your own hash is derived on the server, from your verified email.** If the app
could assert its own hash, anyone could claim someone else's address and be
discovered in their place. An unconfirmed address is never hashed.

**Apple private relay addresses are skipped.** They are generated per-app and
appear in nobody's address book, so hashing one only creates a row that can never
match.

**The pepper is not a secret, and nothing relies on it being one.** It ships
inside the app, because the phone has to hash with the same value. It raises the
cost of a generic precomputed table of email hashes and does nothing else. The
protection here comes from not transmitting identifiers, not from the hash.

**Being findable is your switch.** `discoverable_by_contact` is on by default,
disclosed at signup, and one tap to turn off in Settings. Blocking also hides you
here, exactly as it does everywhere else.

**Rate limits.** 1,000 buckets per request and 5,000 per account per day: one pass
over a large address book, and nowhere near enough to sweep all 65,536 buckets
before anyone notices.

## WHAT WE DECLARE

| | |
|---|---|
| iOS permission string | "To find which of your contacts are already on IDLE. Matching happens on this device and your contacts are never uploaded." |
| Privacy nutrition label | Contacts: **not collected.** We do not receive them |
| Play data safety | Contacts: accessed on device, not collected, not shared |
| GDPR basis | Contract, for matching our own users. No processing of non-users' data occurs |

The declarations say "not collected" because that is literally true, and the two
functions in `supabase/migrations/20260918000600_contacts.sql` are what make it
true. If that ever stops being the case, this page is wrong and the change needs
fresh consent.

## THE CODE

| | |
|---|---|
| `apps/mobile/src/lib/contacts.ts` | Hashing and the intersection, on the device |
| `supabase/migrations/20260918000600_contacts.sql` | `contact_buckets` and `contact_matches` |
| `supabase/tests/08_contacts.sql` | 18 assertions, most of them about what does *not* happen |

## WHAT WE DID NOT BUILD

**Phone number matching.** It would need SMS verification, more personal data and
a cost per user. Email covers the case today; the schema takes a `kind` column so
phone can be added without a migration.

**GitHub connect.** Worth revisiting: a developer's real social graph is their
following list and the people they have committed alongside, and every match there
is by definition someone who codes. See [`ROADMAP.md`](ROADMAP.md).
