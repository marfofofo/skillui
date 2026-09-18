// "IDLE" — App Store 5.1.1(v) and GDPR Art. 17 are the same button.
//
// No deactivation, no "are you sure you want to leave", no retention offer.
// You type your handle and it is gone.

import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { Button } from "@/design/Button";
import { HazardRule } from "@/design/Hazard";
import { usePalette, SPACE, HAIRLINE } from "@/design/tokens";
import { deleteAccount } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function DeleteAccount() {
  const palette = usePalette();
  const { profile } = useSession();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = profile?.handle ?? "";
  const matches = typed.trim().toLowerCase() === handle.toLowerCase() && handle.length > 0;

  async function destroy() {
    setBusy(true);
    try {
      await deleteAccount();
      router.replace("/(auth)/sign-in");
    } catch (e) {
      Alert.alert("COULD NOT DELETE", e instanceof Error ? e.message : "unknown");
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Meta>close</Meta>
        </Pressable>
      </View>

      <View style={{ marginTop: SPACE.l }}>
        <HazardRule />
      </View>

      <T variant="title" style={{ marginTop: SPACE.l }}>
        DELETE EVERYTHING
      </T>

      <T variant="body" style={{ marginTop: SPACE.m, lineHeight: 24 }}>
        Your profile, your presence, every friendship in both directions, every
        pending request, every paired terminal and its token, your invite code and
        your push tokens. Immediately, and permanently.
      </T>

      <T variant="mono" tone="concrete" style={{ marginTop: SPACE.m, lineHeight: 20 }}>
        Reports filed about you are kept for abuse prevention with your identity
        removed. Nothing else survives.
      </T>

      <Meta style={{ marginTop: SPACE.xl }}>type your handle</Meta>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        placeholder={handle}
        placeholderTextColor={palette.concrete}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Type your handle to confirm deletion"
        style={{
          borderBottomWidth: HAIRLINE,
          borderBottomColor: matches ? palette.signal : palette.ink,
          color: palette.ink,
          fontFamily: "InterTight_700Bold",
          fontSize: 32,
          textTransform: "uppercase",
          paddingVertical: SPACE.s,
          marginTop: SPACE.xs,
        }}
      />

      <Button
        label="Delete my account"
        kind="destructive"
        onPress={destroy}
        disabled={!matches}
        busy={busy}
        style={{ marginTop: SPACE.xl }}
      />

      <T variant="mono" tone="concrete" style={{ marginTop: SPACE.m }}>
        You can also delete your account at idle.app/delete without the app.
      </T>
    </Screen>
  );
}
