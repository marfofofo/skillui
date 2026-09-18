// "IDLE" — the 45° hazard rule. A boundary you are crossing. Nothing else.
// BRAND.md §07: used as a rule, never as a fill, at exactly three moments.

import { View } from "react-native";
import Svg, { Defs, Pattern, Path, Rect } from "react-native-svg";
import { RAW, SPACE } from "./tokens";
import { T } from "./Text";

const PITCH = 8;

export function HazardRule({ height = 10 }: { height?: number }) {
  return (
    <View style={{ height }} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern
            id="hazard"
            width={PITCH * 2}
            height={PITCH * 2}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect width={PITCH * 2} height={PITCH * 2} fill={RAW.caution} />
            <Rect width={PITCH} height={PITCH * 2} fill={RAW.ink} />
          </Pattern>
        </Defs>
        <Rect width="100%" height={height} fill="url(#hazard)" />
      </Svg>
    </View>
  );
}

/**
 * The divider between the awake and the rest. The one place the word "IDLE"
 * appears inside the product rather than on it.
 */
export function IdleDivider({ label = "IDLE" }: { label?: string }) {
  return (
    <View style={{ marginTop: SPACE.xl, marginBottom: SPACE.m }}>
      <HazardRule height={10} />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -2,
          alignItems: "center",
        }}
      >
        <View style={{ backgroundColor: RAW.ink, paddingHorizontal: SPACE.s, paddingVertical: 2 }}>
          <T variant="meta" style={{ color: RAW.caution }}>{`"${label}"`}</T>
        </View>
      </View>
    </View>
  );
}
