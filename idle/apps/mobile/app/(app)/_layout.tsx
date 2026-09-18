import { Stack, Redirect } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/lib/session";
import { usePalette } from "@/design/tokens";

export default function AppLayout() {
  const { session, profile, loading } = useSession();
  const palette = usePalette();

  if (loading) return <View style={{ flex: 1, backgroundColor: palette.paper }} />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile) return <Redirect href="/(auth)/handle" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.paper },
        animation: "fade",
        animationDuration: 120,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={{ presentation: "modal" }} />
      <Stack.Screen name="scan" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="person/[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}
