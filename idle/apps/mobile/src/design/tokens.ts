// "IDLE" — BRAND.md, in code. If a value is not here, it does not exist.

import { useColorScheme } from "react-native";

export const RAW = {
  ink: "#0A0A0A",
  paper: "#F4F1EA",
  /** SIGNAL means one thing: a person is awake and building. Nothing else. */
  signal: "#FF3B00",
  caution: "#E4FF3A",
} as const;

export type Palette = {
  ink: string;
  paper: string;
  /** The state colour. Fills, and text on INK only. Identical in both modes. */
  signal: string;
  /**
   * SIGNAL as small TEXT. Pure #FF3B00 clears 4.5:1 against #0A0A0A but only
   * reaches 3.1:1 against #F4F1EA, so which variant is legible depends on what
   * it sits on — and an inverted live row sits on the opposite of the page.
   *   signalOnPaper — on the page background
   *   signalOnInk   — on the inverted row
   * The brand colour never changes. Where it stays legible does.
   */
  signalOnPaper: string;
  signalOnInk: string;
  caution: string;
  concrete: string;
  hairline: string;
};

const LIGHT: Palette = {
  ink: RAW.ink,
  paper: RAW.paper,
  signal: RAW.signal,
  signalOnPaper: "#C42D00", // 4.95:1 on #F4F1EA
  signalOnInk: RAW.signal,  // 5.54:1 on #0A0A0A
  caution: RAW.caution,
  concrete: "#6E6B66",   // 4.66:1 on PAPER
  hairline: "rgba(10,10,10,0.12)",
};

// Dark mode inverts INK and PAPER. SIGNAL never changes; CONCRETE is tuned per
// mode because a single grey cannot clear 4.5:1 against both backgrounds.
const DARK: Palette = {
  ink: RAW.paper,
  paper: RAW.ink,
  signal: RAW.signal,
  signalOnPaper: RAW.signal, // 5.54:1 on #0A0A0A
  signalOnInk: "#C42D00",    // 4.95:1 on #F4F1EA
  caution: RAW.caution,
  concrete: "#9A968F",    // 6.72:1 on INK
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
