// "IDLE" — the row. This is the product.
//
// The 3% (BRAND.md §02): an online friend is not marked with a green dot. The
// whole row inverts. The lights literally come on.

import { Pressable, View } from "react-native";
import { usePalette, SPACE, GUTTER, HAIRLINE } from "./tokens";
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
  const palette = usePalette();

  const background = isLive ? palette.ink : "transparent";
  const foreground = isLive ? palette.paper : palette.ink;

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
        borderBottomColor: palette.hairline,
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
      <T variant="mono" tone="concrete" style={{ marginRight: SPACE.m }}>
        c/o
      </T>
      {isLive ? (
        <T variant="mono" style={{ color: palette.signalOnInk }}>
          {AGENT_LABEL[agent ?? "claude_code"]}
        </T>
      ) : (
        <T variant="mono" tone="concrete">
          —
        </T>
      )}

      {trailing}
    </Pressable>
  );
}
