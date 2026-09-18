// IDLE — the room.
//
// Two layers that sit under everything: a warm field whose strength is how many
// of your friends are awake, and a grain tile so the black reads as a material
// rather than a void.
//
// The aurora is the lamp's colour and no other. It carries the same fact the
// lamps carry, at the scale of the whole screen — you feel how busy the night is
// before you have focused on a single name. BRAND.md §05.

import { Image, View, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { AURORA, COLOR, GRAIN_OPACITY } from "./tokens";

const GRAIN = require("../../assets/grain.png");

export function Aurora({ intensity }: { intensity: number }) {
  const { width, height } = useWindowDimensions();

  const share = Math.max(0, Math.min(1, intensity));
  if (share === 0) return null;

  // Ease the ramp: the first friend awake should be felt, the tenth should not
  // double the brightness.
  const opacity =
    AURORA.minOpacity + (AURORA.maxOpacity - AURORA.minOpacity) * Math.sqrt(share);

  const w = Math.round(width * AURORA.spread);
  const h = Math.round(height * AURORA.height);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        position: "absolute",
        top: -h * 0.35,
        left: (width - w) / 2,
        width: w,
        height: h,
        opacity,
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="room" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={COLOR.lamp} stopOpacity={0.55} />
            <Stop offset="38%" stopColor={COLOR.lamp} stopOpacity={0.2} />
            <Stop offset="70%" stopColor={COLOR.lamp} stopOpacity={0.05} />
            <Stop offset="100%" stopColor={COLOR.lamp} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill="url(#room)" />
      </Svg>
    </View>
  );
}

export function Grain() {
  return (
    <Image
      source={GRAIN}
      resizeMode="repeat"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: GRAIN_OPACITY,
      }}
    />
  );
}
