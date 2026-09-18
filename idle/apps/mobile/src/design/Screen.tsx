import { View, ScrollView, type ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLOR, GUTTER, SPACE } from "./tokens";
import { Aurora, Grain } from "./Room";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  gutter?: boolean;
  /**
   * The share of your friends who are awake, 0–1. Only the screens that show
   * presence pass it; everywhere else the room stays cold, which is correct —
   * the warmth means something and must not appear where there is nothing to mean.
   */
  aurora?: number;
  style?: ViewStyle;
};

export function Screen({ children, scroll = false, gutter = true, aurora = 0, style }: Props) {
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingHorizontal: gutter ? GUTTER : 0,
    paddingTop: insets.top + SPACE.l,
    paddingBottom: insets.bottom + SPACE.l,
  };

  const Body = scroll ? ScrollView : View;

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.canvas }}>
      {/* Dark only in v1, so the bar is always light-on-dark. BRAND.md §03. */}
      <StatusBar style="light" />

      <Aurora intensity={aurora} />
      <Grain />

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
