// IDLE — a secondary surface.
//
// Elevation is luminance, not a shadow: `raise` over `canvas` plus a hairline.
// No blur — a frosted panel over a moving background is where dark interfaces go
// to fail contrast, and it costs a frame on every scroll.

import { View, type ViewStyle } from "react-native";
import { COLOR, HAIRLINE, RADIUS, SPACE } from "./tokens";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: COLOR.raise,
          borderWidth: HAIRLINE,
          borderColor: COLOR.line,
          borderRadius: RADIUS.card,
          padding: SPACE.l,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
