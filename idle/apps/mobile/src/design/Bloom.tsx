// IDLE — the room a lamp lights up.
//
// A soft warm field behind the name of someone who is awake, so a screen of
// friends reads as lit windows at night rather than as a list. Drawn as an SVG
// radial gradient rather than a shadow, because a shadow hard-edges at size.

import { View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { BLOOM, COLOR } from "./tokens";

export function Bloom({ width, height }: { width: number; height: number }) {
  const w = Math.round(width * BLOOM.reach);
  const h = Math.round(height * BLOOM.reach);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        position: "absolute",
        left: -w * 0.18,
        top: (height - h) / 2,
        width: w,
        height: h,
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="bloom" cx="50%" cy="50%" rx="50%" ry="50%">
            {BLOOM.stops.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={COLOR.lamp}
                stopOpacity={stop.opacity}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill="url(#bloom)" />
      </Svg>
    </View>
  );
}
