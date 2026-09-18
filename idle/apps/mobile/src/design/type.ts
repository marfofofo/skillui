// IDLE — six roles. Never a seventh, never italic, never a third family.
//
// Weight 450–500 is the baseline rather than 400: light weights thin out badly
// on a dark background.

import type { TextStyle } from "react-native";

export const FAMILY = {
  light: "Geist_300Light",
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

export type Variant = "display" | "title" | "name" | "body" | "mono" | "label";

export const TYPE: Record<Variant, TextStyle> = {
  display: {
    fontFamily: FAMILY.light,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.4,
  },
  title: {
    fontFamily: FAMILY.regular,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
  },
  name: {
    fontFamily: FAMILY.medium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: FAMILY.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  mono: {
    fontFamily: FAMILY.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  label: {
    fontFamily: FAMILY.monoMedium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
};
