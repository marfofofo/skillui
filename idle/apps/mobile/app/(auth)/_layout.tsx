import { Stack } from "expo-router";
import { usePalette } from "@/design/tokens";

export default function AuthLayout() {
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
