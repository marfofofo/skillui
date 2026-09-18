import { View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { usePalette } from "@/design/tokens";

export default function Index() {
  const { session, profile, loading } = useSession();
  const palette = usePalette();

  if (loading) return <View style={{ flex: 1, backgroundColor: palette.paper }} />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile) return <Redirect href="/(auth)/handle" />;
  return <Redirect href="/(app)" />;
}
