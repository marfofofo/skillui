import { View } from "react-native";
import { router } from "expo-router";
import { T } from "./Text";
import { IconButton } from "./Icon";
import { SPACE } from "./tokens";

export function Header({ title, onClose }: { title?: string; onClose?: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 32,
        marginBottom: SPACE.l,
      }}
    >
      {title ? (
        <T variant="title" style={{ flex: 1 }}>
          {title}
        </T>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <IconButton
        name="close"
        label="Close"
        onPress={onClose ?? (() => router.back())}
      />
    </View>
  );
}
