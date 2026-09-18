# IDLE — DESIGN SYSTEM

The app is named after the state it exists to destroy.

---

## 01 — THE ONE IDEA

**A lamp in a window.**

You open IDLE to find out who is awake. The entire interface is in service of one
glance: a list of people, and a small warm light next to anyone who is building
right now. Everything else — the type, the greys, the spacing — exists to make
that light the only thing your eye lands on.

This is why the product is 98% achromatic. Colour is not decoration here, it is
information, and there is exactly one piece of information worth colouring.

---

## 02 — THE NAMES ARE THE INTERFACE

There is almost no chrome in this product. One line of small mono type at the
top, a row of controls at the bottom, and between them nothing but people, set
large and given room.

This is not minimalism as a style. It is the only honest layout for an app whose
entire content is "these people, and which of them are here". A header, a tab
bar, cards and chrome would all be competing with the one thing you opened it to
see.

Consequences to hold to:

- A screen shows **one** kind of thing. No mixed lists.
- A person gets 84 vertical points whether they are awake or not, so presence
  changing never reflows the page.
- If an element is not a name, a lamp, or a control you need right now, it does
  not go on the main screen.

---

## 03 — DARK ONLY, ON PURPOSE

v1 ships dark and only dark.

A lamp needs a dark room. The warm light that carries this whole product reads as
*a light being on* against near-black; against white it is just an orange dot.
The product is also used at the hours it is about — late, alone, with a terminal
open — and a bright panel dropping out of the menu bar at 1am is a small act of
violence.

The token layer is written so a light theme can be added later without touching a
screen. It is a deliberate omission, not a missing feature.

---

## 04 — COLOUR

Nine values. No gradients, no drop shadows on content, no blur except the one
material behind the desktop panel.

| Token | Value | Contrast | Use |
|---|---|---|---|
| `canvas` | `#050505` | — | The night |
| `raise` | `rgba(255,255,255,0.030)` | — | A surface one step up. Luminance, never a shadow |
| `line` | `rgba(255,255,255,0.07)` | — | The few dividers there are, always 1px |
| `text` | `rgba(255,255,255,0.96)` | 18:1 | The name of someone who is awake |
| `dim` | `rgba(255,255,255,0.58)` | 7:1 | Body copy, secondary names |
| `faint` | `rgba(255,255,255,0.50)` | 5.4:1 | Micro labels, agent names, captions |
| `asleep` | `rgba(255,255,255,0.36)` | 3.1:1 | **Only** the name of someone idle, at 28px+ |
| `lamp` | `#FFC16B` | 13:1 | **The light.** Presence, and nothing else, ever |
| `alarm` | `#FF6B5A` | 7:1 | Destructive actions only |

`asleep` is the one value in this system that does not clear 4.5:1, and it is
allowed exactly one use: a person's name at 28px or larger, where the bar is 3:1.
It must never be used for small text. Nothing else is permitted to be quieter
than `faint`.

**The lamp law.** `lamp` means one thing: *a person is awake and building right
now*. It is never a button, never a link, never a badge, never a brand flourish.
On a well-populated screen it appears two or three times. That restraint is the
entire reason it works — the moment a second thing is amber, the light stops
being information and becomes styling.

Every value above clears WCAG AA at the size it is used. There is no grey below
`faint` in this system, because a grey that fails contrast is not a subtle grey,
it is an unreadable one.

---

## 05 — THE LAMP, AND THE ROOM IT LIGHTS

A 7px circle in `lamp`, with three stacked shadows and nothing else:

```
box-shadow:
  0 0 0 1px rgba(255,193,107,0.25),    /* the filament edge */
  0 0 10px 1px rgba(255,193,107,0.65), /* the glow */
  0 0 22px 4px rgba(255,193,107,0.22); /* the room it lights */
```

Idle is the same circle as a 1px ring in `rgba(255,255,255,0.22)` — a lamp that
is off, not an absence. The two states occupy identical space, so a friend coming
online changes the light and moves nothing.

Behind the name of someone who is awake there is also a **bloom**: a soft warm
radial field, reaching about 2.4 row-heights, at 30% at the centre and gone by
72%. It is drawn as a gradient, never as a shadow, because a shadow hard-edges
when it is scaled.

The bloom is what turns a list of names into lit windows at night. It is also the
first thing that will look dated if it is overdone, so: one per awake person,
never under a control, never under a heading, and never at a higher opacity than
this.

The lamp never animates on arrival. It cuts. A light does not fade in.

---

## 06 — TYPE

Two families, and the split between them is the rule:

> **Instrument Sans for people. Geist Mono for machines.**

A name is set in the sans. An agent, a pairing code, a count, a clock — anything
produced by a computer — is set in the mono, uppercase, letter-spaced. You can
tell what kind of thing you are looking at before you read it.

| Role | Size | Family | Treatment |
|---|---|---|---|
| `display` | 40 | Sans | Tracking −1.3. One per screen, at most |
| `person` | 32 | Sans | Tracking −1. A person, on the main list |
| `personSmall` | 22 | Sans | Tracking −0.6. A person in a secondary list |
| `title` | 24 | Sans | Tracking −0.6 |
| `body` | 16 | Sans | Sentence case |
| `mono` | 11 | Mono | +1 tracking, uppercase. Agents, codes, counts |
| `micro` | 10 | Mono | +1.6 tracking, uppercase. The smallest type in the product |

Regular weight throughout — at 32px on black, anything heavier shouts and
anything lighter falls apart. Never italic. Never a third family.

---

## 07 — SPACE AND SHAPE

Air is the main material.

- Scale: `4 · 8 · 14 · 24 · 40 · 64`. Nothing in between.
- Screen gutter: `28px` on phone, `16px` inside the desktop panel.
- A person is `84px` tall on the main list, `34px` in the desktop panel.
- **Rows have no dividers.** The space between them is the separation; a group is
  divided by more space, not by a line. There is one `line` in the whole main
  screen, above the controls.
- Radius: `0` for lists, `8px` for a row highlight, `16px` for the desktop panel.
- Elevation is luminance: a raised surface is `raise` over `canvas` plus a `line`
  border. No drop shadows on content — only under the floating desktop panel.

---

## 08 — MOTION

- State changes: `120ms`, ease-out. Nothing slower, nothing bouncier.
- A friend coming online: **no transition at all.** The lamp is off, then it is on.
- No spring physics, no parallax, no skeleton shimmer, no pull-to-refresh spinner
  that outstays the request.

The product should feel like a departure board, not a toy.

---

## 09 — THE ICON

The `canvas` square, and a single lamp with its bloom, optically centred at 22% of
the tile width. No word, no glyph, no gradient.

On a home screen of candy-coloured gradients, one small warm light in the dark is
the thing your eye goes to. That is also exactly what the app does.

---

## 10 — VOICE

- Sentence case. Never shout except in `mono` labels, which are uppercase by form.
- No exclamation marks. No emoji anywhere in product chrome.
- Never "user". Say their name, or "friend".
- Errors state the fact and the fix: `No terminal paired — run idle link`.
- Numbers before adjectives: "2 awake", not "a few friends online".

---

## 11 — WHAT WE WILL NOT DO

Written down so it stays written down.

- No feed. There is no content to scroll — only people.
- No streaks, XP, leaderboards or badges. This is not a game.
- No follower counts. There is no number attached to a person anywhere.
- No "who viewed your profile".
- No engagement notifications. The only pushes are a friend request and, opt-in,
  a single friend coming online.
- No duration or intensity in presence by default. A friend sees *that* you are
  building and *which agent*. Nothing else.
- No ads. No promoted anything.

The product is finished when there is nothing left to remove.
