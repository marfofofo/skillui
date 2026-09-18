// IDLE — BRAND.md, in code. If a value is not here, it does not exist.
//
// Dark only in v1 (BRAND.md §02). The shape below is a palette object rather
// than bare constants precisely so a light theme can be added later without
// touching a single screen.

export const COLOR = {
  /** The room. */
  canvas: "#08090B",
  /** One step up. Luminance, never a shadow. */
  raise: "rgba(255,255,255,0.028)",
  /** Every divider and border, always 1px. */
  line: "rgba(255,255,255,0.08)",

  /** 18:1 — people who are awake, headings. */
  text: "rgba(255,255,255,0.95)",
  /** 6.8:1 — people who are idle, body copy. */
  dim: "rgba(255,255,255,0.58)",
  /** 5.3:1 — labels, captions, agent names. */
  faint: "rgba(255,255,255,0.50)",

  /** 13.3:1 — THE LIGHT. Presence and nothing else, ever. See BRAND.md §03. */
  lamp: "#FFC16B",
  /** 7.1:1 — destructive actions only. */
  alarm: "#FF6B5A",
} as const;

export type Color = keyof typeof COLOR;

/** A lamp that is off: the same circle, as a ring. Never an absence. */
export const LAMP_OFF_RING = "rgba(255,255,255,0.22)";

/** The three stacked shadows that make a dot read as a light. BRAND.md §04. */
export const LAMP_GLOW = [
  { color: "rgba(255,193,107,0.25)", offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1 },
  { color: "rgba(255,193,107,0.65)", offsetX: 0, offsetY: 0, blurRadius: 10, spreadDistance: 1 },
  { color: "rgba(255,193,107,0.22)", offsetX: 0, offsetY: 0, blurRadius: 22, spreadDistance: 4 },
] as const;

/** 4 · 8 · 14 · 24 · 36 · 56. Nothing in between. */
export const SPACE = {
  xs: 4,
  s: 8,
  m: 14,
  l: 24,
  xl: 36,
  xxl: 56,
} as const;

export const GUTTER = 24;
export const HAIRLINE = 1;

/** A person occupies exactly this, awake or not, so nothing moves. */
export const ROW_HEIGHT = 56;

export const RADIUS = {
  none: 0,
  row: 7,
  panel: 14,
} as const;

/** 120ms, ease-out. Nothing slower, nothing bouncier. BRAND.md §07. */
export const MOTION = { cut: 0, quick: 120 } as const;
