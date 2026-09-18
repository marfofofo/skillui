// "IDLE" — six sizes. Never a seventh, never italic, never a second family.

import type { TextStyle } from "react-native";

export const FAMILY = {
  regular: "InterTight_400Regular",
  medium: "InterTight_500Medium",
  semibold: "InterTight_600SemiBold",
  bold: "InterTight_700Bold",
} as const;

export type Variant = "display" | "title" | "name" | "body" | "mono" | "meta";

export const TYPE: Record<Variant, TextStyle> = {
  display: {
    fontFamily: FAMILY.bold,
    fontSize: 96,
    lineHeight: 92,
    letterSpacing: -3.84, // -0.04em
    textTransform: "uppercase",
  },
  title: {
    fontFamily: FAMILY.bold,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.96, // -0.03em
    textTransform: "uppercase",
  },
  name: {
    fontFamily: FAMILY.semibold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.44,
    textTransform: "uppercase",
  },
  body: {
    fontFamily: FAMILY.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  mono: {
    fontFamily: FAMILY.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.28,
    fontVariant: ["tabular-nums"],
  },
  meta: {
    fontFamily: FAMILY.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.8, // +0.18em
    textTransform: "uppercase",
  },
};
