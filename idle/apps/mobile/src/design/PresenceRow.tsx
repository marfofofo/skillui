// "IDLE" — the row. This is the product.
//
// The 3% (BRAND.md §02): an online friend is not marked with a green dot. The
// whole row inverts. The lights literally come on.

import { Pressable, View } from "react-native";
import { usePalette, useInvertedPalette, SPACE, GUTTER, HAIRLINE } from "./tokens";
import { T } from "./Text";
import { AGENT_LABEL, type Agent } from "@/lib/types";

type Props = {
  handle: string;
  isLive: boolean;
  agent: Agent | null;
  onPress?: () => void;
  trailing?: React.ReactNode;
};

export function PresenceRow({ handle, isLive, agent, onPress, trailing }: Props) {
  const page = usePalette();
  const inverted = useInvertedPalette();

  // A live row is not the page with different colours — it IS the other mode.
  // Rendering it from the inverted palette means every contrast pairing that
  // holds on the page holds here too, in both themes, for free.
  const palette = isLive ? inverted : page;

  const background = isLive ? palette.paper : "transparent";
  const foreground = palette.ink;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        isLive
          ? `${handle}, building, care of ${AGENT_LABEL[agent ?? "claude_code"]}`
          : `${handle}, idle`
      }
      style={({ pressed }) => ({
        backgroundColor: background,
        opacity: pressed ? 0.85 : 1,
        borderBottomWidth: isLive ? 0 : HAIRLINE,
        borderBottomColor: page.hairline,
        paddingVertical: SPACE.m,
        paddingHorizontal: isLive ? GUTTER : 0,
        marginHorizontal: isLive ? -GUTTER : 0,
        flexDirection: "row",
        alignItems: "center",
      })}
    >
      <T variant="name" style={{ color: foreground, flexShrink: 1 }} numberOfLines={1}>
        {handle}
      </T>

      <View style={{ flex: 1 }} />

      {/* MARCUS          c/o   CLAUDE CODE  — BRAND.md §03 */}
      <T variant="mono" style={{ color: palette.concrete, marginRight: SPACE.m }}>
        c/o
      </T>
      {isLive ? (
        <T variant="mono" style={{ color: palette.signalText }}>
          {AGENT_LABEL[agent ?? "claude_code"]}
        </T>
      ) : (
        <T variant="mono" style={{ color: palette.concrete }}>
          —
        </T>
      )}

      {trailing}
    </Pressable>
  );
}
