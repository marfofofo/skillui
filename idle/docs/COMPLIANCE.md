# COMPLIANCE — SHIPPING TO THE APP STORE AND GOOGLE PLAY

Social apps get rejected for the same handful of reasons every time. Each one
below is a build task, not a legal afterthought, and each maps to something in
`apps/mobile`.

---

## APPLE

### Guideline 1.2 — User-Generated Content (the #1 rejection for social apps)

An app with user-generated content must ship **all** of these. Ours is a thin
social surface (names, handles, bios, avatars), but Apple applies 1.2 to any of it.

| Requirement | Where it lives | Status |
|---|---|---|
| A method for filtering objectionable content | Reserved-handle trigger + length limits on write | **Built** |
| A mechanism to **report** offensive content | Report on every profile sheet, six reasons | **Built** |
| The ability to **block** abusive users | Block — symmetric, total, silent; breaks the edge both ways | **Built** |
| Published contact info for the developer | Settings → Contact us + App Store listing | **Built**, needs a live address |
| Act on reports and eject the offender **within 24 hours** | `reports` table built; **no moderation surface and no rota yet** — see `LAUNCH.md` M4 |
| An EULA users agree to at signup | Linked at signup in the sign-in screen; **the pages do not exist yet** — `LAUNCH.md` M1 |

Blocking must be **symmetric and total**: a blocked account cannot see your
presence, cannot appear in your suggestions, cannot send you a request, and the
friendship edge is deleted in both directions.

### Guideline 5.1.1(v) — Account Deletion

If the app creates an account, it must let the user **delete it from inside the
app**. Offering only deactivation is a rejection. Sending them to a website
without an in-app link is a rejection.

Our implementation: Settings → `"DELETE"` → hazard rule → type your handle to
confirm → `delete_account()` RPC → cascade removes profile, presence, devices,
edges, requests, invite codes and push tokens, revokes every device token, and
signs the user out. Reports filed *against* the account are retained (legal
basis: abuse prevention) with the reported user replaced by a tombstone id.

### Guideline 4.2 — Minimum Functionality

A "who's online" list is a thin premise. The defence is that the terminal pairing
and the friend graph make it a real network, and the app must feel complete on
first launch — which is why the empty state, the QR sheet and the pairing flow are
first-class screens, not placeholders.

### Guideline 5.1.2 — Contacts

Apps get rejected for collecting information about a user's contacts without
those people's knowledge. We access the address book and never collect it: see
[`CONTACTS.md`](CONTACTS.md). What this requires of us in the submission:

- `NSContactsUsageDescription` that says what actually happens, not a euphemism.
- The privacy nutrition label declares Contacts as **not collected**, which is
  only true because the matching is on-device. If that changes, the label changes.
- Review notes must explain the two-step bucket protocol, because a reviewer
  seeing a contacts permission on a social app will assume the usual thing.
- No invite flow of any kind. We never send anything to anyone who is not a user.

### Other Apple items

- **Sign in with Apple** is required if we offer any third-party sign-in (Google).
  If we ship Apple + email only on day one, it is still the right default on iOS.
- **Privacy nutrition labels**: we declare Email (account), Name/handle (account),
  Identifiers (device token), and User Content (avatar). We declare **no** tracking
  and link no data to third-party advertising, because we have none.
- **Age rating**: 12+ (social networking, unrestricted web not applicable).
- **ATT**: not required — we do not track across apps.

---

## GOOGLE PLAY

| Requirement | Note |
|---|---|
| **Data safety form** | Must match `docs/PRESENCE_PROTOCOL.md` and `docs/CONTACTS.md` exactly. Declare: email, name, user IDs. Contacts: accessed on device, **not collected**, not shared. Encrypted in transit, deletable on request. |
| **Account deletion** | In-app, and `idle.app/delete` on the web build — which is the real app, so the URL leads to the actual button rather than a request form. **Built**; needs the domain. |
| **Target API level** | Keep on the current Play requirement; Expo SDK upgrades track it. |
| **16 KB page sizes** | Required for 64-bit native libs. Expo SDK handles it; verify at build. |
| **Families policy** | We are not targeting children. Set the target audience to 13+ (16+ in the EU) so the Families policy does not attach. |
| **UGC policy** | Same report/block surfaces as Apple. Play additionally wants an in-app reporting flow reachable within the content itself. |

---

## GDPR (we are established in the EU — this is not optional)

| Right | Implementation |
|---|---|
| Lawful basis | Contract (Art. 6(1)(b)) for the account and presence; consent for optional push |
| Data minimisation | The protocol is the policy. Four fields. See `PRESENCE_PROTOCOL.md` §2 |
| Third parties' data | None processed. Contact matching happens on the device and transmits 16-bit buckets, not addresses — `CONTACTS.md`. The Twoo decision (BE DPA, €50,000) is the precedent this design exists to avoid |
| Right of access / portability | Settings → `"EXPORT"` → signed JSON of everything we hold, emailed |
| Right to erasure | The same `delete_account()` RPC as 5.1.1(v), completed immediately |
| Records of processing | [`docs/ROPA.md`](ROPA.md) — **written**, from the schema. Needs the legal entity details |
| Processor agreement | Supabase DPA signed; EU region (`eu-central-1`) for the project |
| Sub-processors | Supabase, Expo/EAS, Apple, Google. Listed publicly in the privacy policy |
| Retention | Presence rows hold no history. Heartbeat logs 7 days. Reports 12 months |
| Breach notification | 72 hours. Runbook [`docs/INCIDENT.md`](INCIDENT.md) — **written**. Needs the on-call contact |
| DPO | Not required at our scale; revisit at 100k users or any special-category data |
| Age | 16 in the EU by default (13 where a member state lowers it); enforced at signup |

---

## SECURITY POSTURE

- RLS on every table. The anon key is public by design and grants nothing on its own.
- Device tokens hashed at rest (SHA-256), never logged, never returned after issue.
- Edge functions are the only service-role code, and they authenticate a device
  token before touching a row.
- No secrets in the repo. EAS secrets + Supabase project secrets.
- Dependabot on, `npm audit` in CI, and the agent CLI has **zero runtime
  dependencies** so its supply chain is exactly Node itself.

---

## PRE-SUBMISSION CHECKLIST

```
[ ] Report, block and mute shipped and reachable from every profile
[ ] In-app account deletion + public web deletion URL live
[ ] EULA + privacy policy URLs live and linked at signup
[ ] Privacy nutrition labels filled and matching the protocol doc
[ ] Play data safety form filled and matching the protocol doc
[ ] Sign in with Apple present if any third-party sign-in is present
[ ] Age gate at signup (16 EU / 13 elsewhere)
[ ] Contacts declared "not collected" on both stores, and still true
[ ] Review notes explain the on-device contact matching
[ ] Demo account with seeded friends for App Review (they cannot pair a terminal)
[ ] Review notes explaining the terminal pairing step, with a screencast
[ ] Screenshots for every required device size
[ ] Support URL + reachable support email
[ ] 24-hour moderation SLA documented and staffed
```

The **demo account** line matters more than it looks: App Review cannot install
Claude Code and pair a terminal. Ship a reviewer account whose friends are already
seeded and whose presence is simulated server-side, and say so in the review notes.
Without it, 4.2 and 2.1 rejections are near certain.
