# `"IDLE"` — the app

Expo + expo-router. One codebase, iOS and Android.

```bash
cp .env.example .env     # both values are public; RLS is what protects the data
npm install
npx expo start
```

## SCREENS

| Route | What it is |
|---|---|
| `(auth)/sign-in` | Email link, and Sign in with Apple on iOS |
| `(auth)/handle` | The one thing you cannot change later |
| `(app)/index` | **THE LIST.** Awake friends invert; the rest sit under the hazard rule |
| `(app)/add` | Your QR and your code; their code. No search box, ever |
| `(app)/scan` | Camera, QR only, nothing stored |
| `(app)/requests` | Accept or don't |
| `(app)/suggestions` | Friends of friends, ranked by who you have in common |
| `(app)/person/[id]` | A person — and the block/report surface Guideline 1.2 requires |
| `(app)/settings/pair` | The pairing code and the command to run |
| `(app)/settings/devices` | Every paired terminal, revocable individually |
| `(app)/settings/delete` | 5.1.1(v) and GDPR Art. 17, in one button |

## THE DESIGN SYSTEM IS CODE

`src/design/` is `BRAND.md` compiled. If a colour, a type size or a spacing value
is not in `tokens.ts` or `type.ts`, it does not exist. Two rules worth repeating:

- **`SIGNAL` (`#FF3B00`) means one thing**: a person is awake and building. It is
  never a CTA, never an error, never a badge.
- **No easing curves.** State changes are instant or a 120ms cut. A friend coming
  online does not fade in.

## PRESENCE

`src/lib/presence.ts` fetches once, then subscribes to Postgres changes on the
`presence` table. Realtime honours row-level security, so the subscription
delivers your friends' rows and nothing else. It reconciles on app foreground
because a backgrounded socket misses events.

Nothing runs in the background. The app has no battery cost when closed, because
your terminal — not your phone — is what reports that you are awake.

## BUILDING

```bash
eas build --profile preview  --platform all
eas build --profile production --platform all
eas submit --profile production --platform all
```

Fill the `REPLACE_ME` values in `eas.json` and put the EAS project id in
`app.json` before the first production build. See `../../docs/COMPLIANCE.md` for
what must exist before submitting — in particular the seeded reviewer account,
without which App Review cannot use the app at all.

---

`"README"`
