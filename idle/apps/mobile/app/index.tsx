import { View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { takeInvite } from "@/lib/invite";
import { COLOR } from "@/design/tokens";

export default function Index() {
  const { session, profile, loading } = useSession();

  if (loading) return <View style={{ flex: 1, backgroundColor: COLOR.canvas }} />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile) return <Redirect href="/(auth)/handle" />;

  // An invite link that arrived before there was an account gets its turn now.
  const invite = takeInvite();
  if (invite) return <Redirect href={`/i/${invite}`} />;

  return <Redirect href="/(app)" />;
}
