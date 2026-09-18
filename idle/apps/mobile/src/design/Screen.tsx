import { View, ScrollView, type ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLOR, GUTTER, SPACE } from "./tokens";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  gutter?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, scroll = false, gutter = true, style }: Props) {
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingHorizontal: gutter ? GUTTER : 0,
    paddingTop: insets.top + SPACE.l,
    paddingBottom: insets.bottom + SPACE.l,
  };

  const Body = scroll ? ScrollView : View;

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.canvas }}>
      {/* Dark only in v1, so the bar is always light-on-dark. BRAND.md §02. */}
      <StatusBar style="light" />
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
