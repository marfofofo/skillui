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

## 02 — DARK ONLY, ON PURPOSE

v1 ships dark and only dark.

A lamp needs a dark room. The warm light that carries this whole product reads as
*a light being on* against near-black; against white it is just an orange dot.
The product is also used at the hours it is about — late, alone, with a terminal
open — and a bright panel dropping out of the menu bar at 1am is a small act of
violence.

The token layer is written so a light theme can be added later without touching a
screen. It is a deliberate omission, not a missing feature.

---

## 03 — COLOUR

Eight values. No gradients, no drop shadows on content, no blur except the one
material behind the desktop panel.

| Token | Value | Contrast | Use |
|---|---|---|---|
| `canvas` | `#08090B` | — | The room |
| `raise` | `rgba(255,255,255,0.028)` | — | A surface one step up. Luminance, never a shadow |
| `line` | `rgba(255,255,255,0.08)` | — | Every divider and border, always 1px |
| `text` | `rgba(255,255,255,0.95)` | 18:1 | Names of people who are awake, headings |
| `dim` | `rgba(255,255,255,0.58)` | 6.8:1 | Names of people who are idle, body copy |
| `faint` | `rgba(255,255,255,0.50)` | 5.3:1 | Labels, captions, the agent name |
| `lamp` | `#FFC16B` | 13.3:1 | **The light.** Presence, and nothing else, ever |
| `alarm` | `#FF6B5A` | 7.1:1 | Destructive actions only |

**The lamp law.** `lamp` means one thing: *a person is awake and building right
now*. It is never a button, never a link, never a badge, never a brand flourish.
On a well-populated screen it appears two or three times. That restraint is the
entire reason it works — the moment a second thing is amber, the light stops
being information and becomes styling.

Every value above clears WCAG AA at the size it is used. There is no grey below
`faint` in this system, because a grey that fails contrast is not a subtle grey,
it is an unreadable one.

---

## 04 — THE LAMP

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

The lamp never animates on arrival. It cuts. A light does not fade in.

---

## 05 — TYPE

One family, one mono. **Geist** and **Geist Mono**.

| Role | Size / Weight | Treatment |
|---|---|---|
| `display` | 40 / 300 | Tracking −1.4. The one large thing on a screen, at most |
| `title` | 24 / 400 | Tracking −0.6 |
| `name` | 16 / 450 | Tracking −0.1. A person |
| `body` | 15 / 400 | The only place sentence case is the default |
| `mono` | 11 / 500 | Geist Mono, +0.9 tracking, uppercase. Agents, codes, counts |
| `label` | 10 / 500 | Geist Mono, +1.4 tracking, uppercase. Section headers |

Weight 450–500 is the baseline, not 400: light weights thin out badly on a dark
background. There are no poster-sized headings anywhere except the empty state —
this product is a glance, not an editorial.

Never italic. Never a third family.

---

## 06 — SPACE AND SHAPE

- Scale: `4 · 8 · 14 · 24 · 36 · 56`. Nothing in between.
- Screen gutter: `24px` on phone, `16px` inside the desktop panel.
- A list row is `56px` tall on phone, `34px` in the panel. Rows have no dividers
  between them — the space is the separation. A single `line` divides *groups*.
- Radius: `0` for full-bleed lists, `7px` for a row highlight, `14px` for the
  desktop panel. Nothing else is rounded.
- Elevation is luminance: a raised surface is `raise` over `canvas` plus a `line`
  border. There are no drop shadows on content, only under the floating panel.

---

## 07 — MOTION

- State changes: `120ms`, ease-out. Nothing slower, nothing bouncier.
- A friend coming online: **no transition at all.** The lamp is off, then it is on.
- No spring physics, no parallax, no skeleton shimmer, no pull-to-refresh spinner
  that outstays the request.

The product should feel like a departure board, not a toy.

---

## 08 — THE ICON

The `canvas` square, and a single lamp with its bloom, optically centred at 22% of
the tile width. No word, no glyph, no gradient.

On a home screen of candy-coloured gradients, one small warm light in the dark is
the thing your eye goes to. That is also exactly what the app does.

---

## 09 — VOICE

- Sentence case. Never shout except in `mono` labels, which are uppercase by form.
- No exclamation marks. No emoji anywhere in product chrome.
- Never "user". Say their name, or "friend".
- Errors state the fact and the fix: `No terminal paired — run idle link`.
- Numbers before adjectives: "2 awake", not "a few friends online".

---

## 10 — WHAT WE WILL NOT DO

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
