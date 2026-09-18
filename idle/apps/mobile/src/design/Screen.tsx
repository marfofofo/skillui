import { View, ScrollView, type ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { usePalette, GUTTER, SPACE } from "./tokens";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  gutter?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, scroll = false, gutter = true, style }: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();

  const padding: ViewStyle = {
    paddingHorizontal: gutter ? GUTTER : 0,
    paddingTop: insets.top + SPACE.m,
    paddingBottom: insets.bottom + SPACE.l,
  };

  const Body = scroll ? ScrollView : View;

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Body
        style={[{ flex: 1 }, scroll ? undefined : padding, style]}
        contentContainerStyle={scroll ? padding : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Body>
    </View>
  );
}
