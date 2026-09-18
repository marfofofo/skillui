import { Stack } from "expo-router";
import { usePalette } from "@/design/tokens";

export default function SettingsLayout() {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.paper },
        animation: "fade",
        animationDuration: 120,
      }}
    />
  );
}
