import { Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { Button } from "@/design/Button";
import { usePalette, SPACE, HAIRLINE } from "@/design/tokens";
import { useSession } from "@/lib/session";

function Row({ label, meta, onPress }: { label: string; meta: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        paddingVertical: SPACE.m,
        borderBottomWidth: HAIRLINE,
        borderBottomColor: palette.hairline,
      }}
    >
      <Meta>{meta}</Meta>
      <T variant="name" style={{ marginTop: SPACE.xs }}>
        {label}
      </T>
    </Pressable>
  );
}

export default function Settings() {
  const { profile, signOut } = useSession();

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T variant="title" style={{ flex: 1 }}>
          SETTINGS
        </T>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Meta>close</Meta>
        </Pressable>
      </View>

      <View style={{ marginTop: SPACE.l }}>
        <Meta>you</Meta>
        <T variant="display" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: SPACE.xs }}>
          {profile?.handle ?? "—"}
        </T>
      </View>

      <View style={{ marginTop: SPACE.xl }}>
        <Row label="Pair a terminal" meta="terminal" onPress={() => router.push("/(app)/settings/pair")} />
        <Row label="Devices" meta="devices" onPress={() => router.push("/(app)/settings/devices")} />
        <Row label="Requests" meta="requests" onPress={() => router.push("/(app)/requests")} />
      </View>

      <View style={{ marginTop: SPACE.xl }}>
        <Row
          label="What we know about you"
          meta="privacy"
          onPress={() => Linking.openURL("https://idle.app/protocol")}
        />
        <Row
          label="Privacy policy"
          meta="legal"
          onPress={() => Linking.openURL("https://idle.app/privacy")}
        />
        <Row
          label="Terms"
          meta="legal"
          onPress={() => Linking.openURL("https://idle.app/terms")}
        />
        <Row
          label="Contact us"
          meta="support"
          onPress={() => Linking.openURL("mailto:support@idle.app")}
        />
      </View>

      <View style={{ marginTop: SPACE.xl, gap: SPACE.s }}>
        <Button label="Sign out" kind="ghost" onPress={signOut} />
        <Button
          label="Delete account"
          kind="destructive"
          onPress={() => router.push("/(app)/settings/delete")}
          meta="delete"
        />
      </View>
    </Screen>
  );
}
