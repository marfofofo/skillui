// IDLE — the two things that get you in.
//
// Not a wizard: the same lamp vocabulary as everything else, so a step you have
// finished reads exactly like a friend who is awake.

import { Pressable, View } from "react-native";
import { COLOR, SPACE, RADIUS } from "./tokens";
import { T } from "./Text";
import { Lamp } from "./Lamp";

export function Step({
  done,
  title,
  description,
  action,
  onPress,
}: {
  done: boolean;
  title: string;
  description: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={done}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${done ? "Done" : action}`}
      accessibilityState={{ disabled: done }}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: SPACE.m,
        paddingVertical: SPACE.m,
        paddingHorizontal: SPACE.s,
        marginHorizontal: -SPACE.s,
        borderRadius: RADIUS.row,
        backgroundColor: pressed && !done ? COLOR.raise : "transparent",
        opacity: done ? 0.55 : 1,
      })}
    >
      <View style={{ paddingTop: 7 }}>
        <Lamp on={done} />
      </View>

      <View style={{ flex: 1 }}>
        <T variant="personSmall" tone={done ? "dim" : "text"}>
          {title}
        </T>
        <T variant="body" tone="faint" style={{ fontSize: 14, lineHeight: 20, marginTop: SPACE.xs }}>
          {description}
        </T>
        {!done && (
          <T variant="mono" tone="lamp" style={{ marginTop: SPACE.s }}>
            {action}
          </T>
        )}
      </View>
    </Pressable>
  );
}
