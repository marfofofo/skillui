// IDLE — a person.
//
// One glance: a light, a name, and what they are speaking through. The row is a
// fixed height whether the lamp is on or off, so presence changing never moves
// anything else on the screen.

import { Pressable, View } from "react-native";
import { COLOR, SPACE, ROW_HEIGHT, RADIUS } from "./tokens";
import { T } from "./Text";
import { Lamp } from "./Lamp";
import { AGENT_LABEL, type Agent } from "@/lib/types";

type Props = {
  handle: string;
  isLive: boolean;
  agent: Agent | null;
  onPress?: () => void;
  trailing?: React.ReactNode;
};

export function PresenceRow({ handle, isLive, agent, onPress, trailing }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        isLive
          ? `${handle}, building, via ${AGENT_LABEL[agent ?? "claude_code"]}`
          : `${handle}, idle`
      }
      style={({ pressed }) => ({
        height: ROW_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.m,
        paddingHorizontal: SPACE.s,
        marginHorizontal: -SPACE.s,
        borderRadius: RADIUS.row,
        backgroundColor: pressed ? COLOR.raise : "transparent",
      })}
    >
      <Lamp on={isLive} />

      <T variant="name" tone={isLive ? "text" : "dim"} numberOfLines={1} style={{ flexShrink: 1 }}>
        {handle}
      </T>

      <View style={{ flex: 1 }} />

      <T variant="mono" tone="faint">
        {isLive ? AGENT_LABEL[agent ?? "claude_code"] : "—"}
      </T>

      {trailing}
    </Pressable>
  );
}
