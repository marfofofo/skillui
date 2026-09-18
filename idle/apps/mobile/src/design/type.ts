// IDLE — the type is the interface.
//
// There is almost no chrome in this product, so names carry the whole screen.
// Instrument Sans for people, Geist Mono for machines: the two things the app
// talks about, told apart by their typeface.

import type { TextStyle } from "react-native";

export const FAMILY = {
  regular: "InstrumentSans_400Regular",
  medium: "InstrumentSans_500Medium",
  semibold: "InstrumentSans_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

export type Variant =
  | "display"
  | "person"
  | "personSmall"
  | "title"
  | "body"
  | "mono"
  | "micro";

export const TYPE: Record<Variant, TextStyle> = {
  /** The one large thing on a screen, at most. */
  display: {
    fontFamily: FAMILY.regular,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.3,
  },
  /** A person. The primary unit of this product. */
  person: {
    fontFamily: FAMILY.regular,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
  },
  /** A person in a secondary list, where 32px would shout. */
  personSmall: {
    fontFamily: FAMILY.regular,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: FAMILY.regular,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
  },
  body: {
    fontFamily: FAMILY.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  /** Machines: agents, codes, counts. */
  mono: {
    fontFamily: FAMILY.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  /** The smallest type in the product, and the only shouting. */
  micro: {
    fontFamily: FAMILY.monoMedium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
};
