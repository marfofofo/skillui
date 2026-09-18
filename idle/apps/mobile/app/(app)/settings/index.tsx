import { Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Button } from "@/design/Button";
import { COLOR, SPACE, HAIRLINE, ROW_HEIGHT } from "@/design/tokens";
import { useSession } from "@/lib/session";

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        height: ROW_HEIGHT,
        justifyContent: "center",
        borderBottomWidth: HAIRLINE,
        borderBottomColor: COLOR.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <T variant="name" tone="dim">
        {label}
      </T>
    </Pressable>
  );
}

export default function Settings() {
  const { profile, signOut } = useSession();

  return (
    <Screen scroll>
      <Header title="Settings" />

      <T variant="display">{profile?.handle ?? "—"}</T>

      <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>Terminals</Label>
      <Row label="Pair a terminal" onPress={() => router.push("/(app)/settings/pair")} />
      <Row label="Devices" onPress={() => router.push("/(app)/settings/devices")} />

      <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>People</Label>
      <Row label="Requests" onPress={() => router.push("/(app)/requests")} />
      <Row label="Find friends from contacts" onPress={() => router.push("/(app)/contacts")} />

      <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>About</Label>
      <Row
        label="What we know about you"
        onPress={() => Linking.openURL("https://idle.app/protocol")}
      />
      <Row label="Privacy policy" onPress={() => Linking.openURL("https://idle.app/privacy")} />
      <Row label="Terms" onPress={() => Linking.openURL("https://idle.app/terms")} />
      <Row label="Contact us" onPress={() => Linking.openURL("mailto:support@idle.app")} />

      <View style={{ marginTop: SPACE.xl, gap: SPACE.s }}>
        <Button label="Sign out" kind="quiet" onPress={signOut} />
        <Button
          label="Delete account"
          kind="destructive"
          onPress={() => router.push("/(app)/settings/delete")}
        />
      </View>
    </Screen>
  );
}
