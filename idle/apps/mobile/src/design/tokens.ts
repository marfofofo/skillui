// IDLE — BRAND.md, in code. If a value is not here, it does not exist.
//
// Dark only in v1 (BRAND.md §02). The palette is an object rather than bare
// constants precisely so a light theme can be added later without touching a
// single screen.

export const COLOR = {
  /** The night. Deeper than the usual near-black, because the light has to carry. */
  canvas: "#050505",
  /** One step up. Luminance, never a shadow. */
  raise: "rgba(255,255,255,0.030)",
  /** Every divider and border, always 1px. Used sparingly — space divides here. */
  line: "rgba(255,255,255,0.07)",

  /** 18:1 — the name of someone who is awake. */
  text: "rgba(255,255,255,0.96)",
  /** 7:1 — body copy, secondary names. */
  dim: "rgba(255,255,255,0.58)",
  /** 5.4:1 — micro labels, agent names, captions. */
  faint: "rgba(255,255,255,0.50)",
  /** 3.1:1 — ONLY the name of someone idle, at 28px or larger. Never small text. */
  asleep: "rgba(255,255,255,0.36)",

  /** 13:1 — THE LIGHT. Presence and nothing else, ever. BRAND.md §03. */
  lamp: "#FFC16B",
  /** 7:1 — destructive actions only. */
  alarm: "#FF6B5A",
} as const;

export type Color = keyof typeof COLOR;

/** A lamp that is off: the same circle, as a ring. Never an absence. */
export const LAMP_OFF_RING = "rgba(255,255,255,0.20)";

/** The three stacked shadows that make a dot read as a light. BRAND.md §04. */
export const LAMP_GLOW = [
  { color: "rgba(255,193,107,0.25)", offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1 },
  { color: "rgba(255,193,107,0.65)", offsetX: 0, offsetY: 0, blurRadius: 10, spreadDistance: 1 },
  { color: "rgba(255,193,107,0.22)", offsetX: 0, offsetY: 0, blurRadius: 22, spreadDistance: 4 },
] as const;

/**
 * The warm bloom behind an awake name — the room the lamp lights up.
 * BRAND.md §04. Rendered as an SVG radial gradient, not a shadow, so it stays
 * soft at any size.
 */
export const BLOOM = {
  /** How far the light reaches, as a multiple of the row height. */
  reach: 2.4,
  stops: [
    { offset: "0%", opacity: 0.3 },
    { offset: "45%", opacity: 0.1 },
    { offset: "72%", opacity: 0 },
  ],
} as const;

/** 4 · 8 · 14 · 24 · 40 · 64. Air is the main material here. */
export const SPACE = {
  xs: 4,
  s: 8,
  m: 14,
  l: 24,
  xl: 40,
  xxl: 64,
} as const;

export const GUTTER = 28;
export const HAIRLINE = 1;

/** A person occupies exactly this, awake or not, so nothing moves. */
export const ROW_HEIGHT = 84;

export const RADIUS = {
  none: 0,
  row: 8,
  panel: 16,
} as const;

/** 120ms, ease-out. Nothing slower, nothing bouncier. BRAND.md §07. */
export const MOTION = { cut: 0, quick: 120 } as const;
