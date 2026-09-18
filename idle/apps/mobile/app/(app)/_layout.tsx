import { useEffect } from "react";
import { Stack, Redirect } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/lib/session";
import { registerForPush } from "@/lib/push";
import { COLOR } from "@/design/tokens";
import { SCREEN_OPTIONS } from "../_layout";

export default function AppLayout() {
  const { session, profile, loading } = useSession();

  // Expo push tokens rotate, so refresh it on launch — but never ask for
  // permission here. That happens in Settings, where the reason is visible.
  useEffect(() => {
    if (session && profile) registerForPush({ prompt: false });
  }, [session, profile]);

  if (loading) return <View style={{ flex: 1, backgroundColor: COLOR.canvas }} />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile) return <Redirect href="/(auth)/handle" />;

  return (
    <Stack screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={{ presentation: "modal" }} />
      <Stack.Screen name="scan" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="person/[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}
