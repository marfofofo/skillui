// IDLE — the light. This is the product.
//
// BRAND.md §04: a 7px circle with three stacked shadows. Off is the same circle
// as a ring, never an absence, so the two states occupy identical space and a
// friend coming online moves nothing on the screen.

import { View } from "react-native";
import { COLOR, LAMP_GLOW, LAMP_OFF_RING } from "./tokens";

type Props = {
  on: boolean;
  size?: number;
  /** The glow is expensive to stack dozens of times; off in dense lists. */
  glow?: boolean;
};

export function Lamp({ on, size = 7, glow = true }: Props) {
  if (!on) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: LAMP_OFF_RING,
        }}
      />
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLOR.lamp,
        // A light does not fade in. There is no transition here on purpose.
        ...(glow ? { boxShadow: [...LAMP_GLOW] } : null),
      }}
    />
  );
}
