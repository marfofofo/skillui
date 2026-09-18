import { View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { COLOR } from "@/design/tokens";

export default function Index() {
  const { session, profile, loading } = useSession();

  if (loading) return <View style={{ flex: 1, backgroundColor: COLOR.canvas }} />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile) return <Redirect href="/(auth)/handle" />;
  return <Redirect href="/(app)" />;
}
