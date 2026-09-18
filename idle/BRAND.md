# `"IDLE"` — DESIGN SYSTEM

> `"SOCIAL NETWORK"` FOR ENGINEERS
> c/o 2026

---

## 01 — THE IDEA

The name is a readymade. We take the word that describes the state the product
exists to destroy, put it in quotation marks, and use it as the logo.

You open `"IDLE"` precisely when you don't want to be idle. You open it to find
out who is awake, who is building, who is in it right now — so you can be in it
too. The irony is the whole brand.

**The quotation marks are not decoration. They are the logo.** They are never
dropped, never styled as curly typographic quotes in the wordmark (straight
double quotes only, `"IDLE"`), and never replaced by an icon.

---

## 02 — THE 3% RULE

Abloh's rule: take a familiar object, change it by 3%, and it becomes new.

Every screen in `"IDLE"` is a screen you have already used a thousand times —
a friends list, a QR invite sheet, a profile — shifted exactly 3%:

| Familiar object | The 3% shift |
|---|---|
| Friends list | Sorted by **who is awake**, not alphabetically. Offline friends don't disappear, they sit below a hazard rule labelled `"IDLE"`. |
| Online dot | Not a green dot. The whole row **inverts** — ink on paper becomes paper on ink. The lights literally come on. |
| Status text | Not "Online". `MARCUS  c/o  CLAUDE CODE`. |
| Add friend | Not a search box. A **code**, a **link**, a **QR** — you have to know someone. |
| Empty state | Not "No friends yet". `"NOBODY"` set at 96pt. |

If a screen doesn't have its 3%, it isn't finished.

---

## 03 — THE `c/o` GRAMMAR

`c/o` — *care of* — is the presence string of the entire product. You are never
just online; you are online **care of** the machine you are speaking through.

```
MARCUS          c/o   CLAUDE CODE
SOFIA           c/o   CODEX
LUCA            c/o   —
```

- `c/o` is always lowercase, always surrounded by wide space (never a comma).
- The agent name is always uppercase.
- When a friend is idle, the agent slot is an em dash. Never the word "offline".

---

## 04 — META-LABELLING

Every interactive surface is labelled with what it literally is, in quotes, in
the smallest type on screen, uppercase, letter-spaced.

```
"BUTTON"      "FRIEND"      "INVITE"      "STATUS"
"QR CODE"     "SETTINGS"    "REPORT"      "DELETE"
```

The label sits above or beside the object, in `CONCRETE`, at 10pt / +0.18em.
It is a caption on a museum wall, not a hint. It never explains — it names.

Rule: a meta-label never repeats the object's own visible text. If a button
already says `INVITE`, its meta-label is `"BUTTON"`.

---

## 05 — COLOR

Six values. No gradients. No shadows. No blur. Ever.

| Token | Hex | Use |
|---|---|---|
| `INK` | `#0A0A0A` | Text, rules, the idle world |
| `PAPER` | `#F4F1EA` | Background. Off-white — the joke is intentional |
| `SIGNAL` | `#FF3B00` | **Live.** Reserved exclusively for presence. Nothing else may use it |
| `CAUTION` | `#E4FF3A` | Hazard stripes, warnings, destructive confirms |
| `CONCRETE` | `#8A8782` | Meta-labels, idle friends, secondary text |
| `HAIRLINE` | `INK` @ 12% | Every divider, every border. Always exactly 1px |

**The `SIGNAL` law.** `SIGNAL` means one thing and only one thing: *a human being
is awake and building right now*. It is never used for a CTA, never for an error,
never for a badge. Spend it on nothing else and it will carry the entire product.

Dark mode inverts `INK` ⇄ `PAPER` and nothing else. `SIGNAL` never changes.

---

## 06 — TYPE

One family. Helvetica Neue on iOS; **Inter Tight** bundled everywhere as the
single source of truth so Android and iOS are identical.

| Role | Size / Weight | Treatment |
|---|---|---|
| `DISPLAY` | 96 / 700 | UPPERCASE, tracking −0.04em. Empty states, the wordmark |
| `TITLE` | 32 / 700 | UPPERCASE, tracking −0.03em |
| `NAME` | 22 / 600 | UPPERCASE. Friend names are always uppercase |
| `BODY` | 16 / 400 | Sentence case. The only place sentence case is allowed |
| `MONO` | 14 / 500 | Agent names, codes, `c/o` strings. Inter Tight tabular figures |
| `META` | 10 / 600 | UPPERCASE, tracking +0.18em. Meta-labels only |

Never italic. Never a second typeface. Never a font size between these six.

---

## 07 — HAZARD

The 45° diagonal stripe, `INK` on `CAUTION`, 8px pitch. Used as a **rule**, never
as a fill, and only at three moments:

1. The divider between awake friends and `"IDLE"` friends.
2. Above any destructive action (account deletion, unfriend, block).
3. The top edge of the pairing screen, where the terminal meets the phone.

A hazard stripe means *a boundary you are crossing*. Nothing else.

---

## 08 — MOTION

Industrial. There is no easing curve in this product.

- State changes are **instant** (0ms) or **snapped** (120ms linear). Nothing else.
- A friend coming online does not fade in. It **cuts**. One frame idle, next frame live.
- No spring physics, no bounce, no parallax, no skeleton shimmer.
- The only animation longer than 120ms is the hazard stripe, which scrolls at 8px/s
  forever and never stops.

The product should feel like a departure board, not a toy.

---

## 09 — THE ICON

A pure `INK` square. No radius of our own (the OS masks it). `"IDLE"` in `PAPER`,
Inter Tight 700, optically centred, quotation marks included, occupying 72% of the
tile width.

That's it. No mark, no glyph, no gradient. On a home screen full of rounded candy
gradients, a flat black tile with a word in quotes is the 3%.

---

## 10 — VOICE

- Lowercase never. Sentence case only in `BODY`.
- Never exclamation marks. Never emoji in product chrome.
- Never say "user". Say the person's name, or `"FRIEND"`.
- Never apologise. Errors state the fact: `TERMINAL NOT LINKED`.
- Never explain the joke.

---

## 11 — WHAT WE WILL NOT DO

Written down so it stays written down.

- No streaks, no XP, no leaderboards, no badges. This is not a game.
- No infinite feed. There is no content to scroll — only people.
- No engagement notifications. The only push we ever send is a friend request
  and, opt-in, a single friend coming online.
- No follower counts. There is no number attached to a person anywhere.
- No ads. No promoted anything.
- No "who viewed your profile".

The product is finished when there is nothing left to remove.
