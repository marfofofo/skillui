// "IDLE" — BRAND.md, in code. If a value is not here, it does not exist.

import { useColorScheme } from "react-native";

export const RAW = {
  ink: "#0A0A0A",
  paper: "#F4F1EA",
  /** SIGNAL means one thing: a person is awake and building. Nothing else. */
  signal: "#FF3B00",
  caution: "#E4FF3A",
  concrete: "#8A8782",
} as const;

export type Palette = {
  ink: string;
  paper: string;
  signal: string;
  caution: string;
  concrete: string;
  hairline: string;
};

const LIGHT: Palette = {
  ink: RAW.ink,
  paper: RAW.paper,
  signal: RAW.signal,
  caution: RAW.caution,
  concrete: RAW.concrete,
  hairline: "rgba(10,10,10,0.12)",
};

// Dark mode inverts INK and PAPER and nothing else. SIGNAL never changes.
const DARK: Palette = {
  ink: RAW.paper,
  paper: RAW.ink,
  signal: RAW.signal,
  caution: RAW.caution,
  concrete: RAW.concrete,
  hairline: "rgba(244,241,234,0.14)",
};

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}

/** 8pt grid. There is no spacing value between these. */
export const SPACE = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 40,
  xxl: 64,
} as const;

/** The 16px side gutter, everywhere, on every screen. */
export const GUTTER = 16;

export const HAIRLINE = 1;

/** Industrial: instant, or a 120ms cut. There is no easing curve. */
export const MOTION = { instant: 0, cut: 120 } as const;
