// IDLE — a person.
//
// The name carries the row; the lamp says whether they are here. The agent sits
// underneath in mono, because it is a machine and the type says so. The row is a
// fixed height whether the lamp is on or off, so presence changing never moves
// anything else on the screen.

import { Pressable, View } from "react-native";
import { COLOR, SPACE, ROW_HEIGHT, RADIUS } from "@/design/tokens";
import { T } from "./Text";
import { Lamp } from "./Lamp";
import { Bloom } from "./Bloom";
import { AGENT_LABEL, type Agent } from "@/lib/types";

type Props = {
  handle: string;
  isLive: boolean;
  agent: Agent | null;
  onPress?: () => void;
  width?: number;
};

export function PresenceRow({ handle, isLive, agent, onPress, width = 340 }: Props) {
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
        justifyContent: "center",
        paddingHorizontal: SPACE.s,
        marginHorizontal: -SPACE.s,
        borderRadius: RADIUS.row,
        backgroundColor: pressed ? COLOR.raise : "transparent",
      })}
    >
      {isLive && <Bloom width={width} height={ROW_HEIGHT} />}

      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.m }}>
        <Lamp on={isLive} />
        <T
          variant="person"
          tone={isLive ? "text" : "asleep"}
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {handle}
        </T>
      </View>

      <T
        variant="micro"
        tone={isLive ? "faint" : "asleep"}
        style={{ marginTop: SPACE.s, marginLeft: 7 + SPACE.m }}
      >
        {isLive ? AGENT_LABEL[agent ?? "claude_code"] : "idle"}
      </T>
    </Pressable>
  );
}
