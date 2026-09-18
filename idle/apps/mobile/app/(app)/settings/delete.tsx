// IDLE — App Store 5.1.1(v) and GDPR Art. 17 are the same button.
//
// No deactivation, no "are you sure you want to leave", no retention offer.

import { useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T } from "@/design/Text";
import { Header } from "@/design/Header";
import { Field } from "@/design/Field";
import { Button } from "@/design/Button";
import { SPACE } from "@/design/tokens";
import { deleteAccount } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function DeleteAccount() {
  const { profile } = useSession();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = profile?.handle ?? "";
  const matches = handle.length > 0 && typed.trim().toLowerCase() === handle.toLowerCase();

  async function destroy() {
    setBusy(true);
    try {
      await deleteAccount();
      router.replace("/(auth)/sign-in");
    } catch (e) {
      Alert.alert("Could not delete", e instanceof Error ? e.message : "unknown");
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header />

      <T variant="title" tone="alarm">
        Delete everything
      </T>

      <T variant="body" tone="dim" style={{ marginTop: SPACE.m }}>
        Your profile, your presence, every friendship in both directions, every
        pending request, every paired terminal and its token, your invite code and
        your push tokens. Immediately, and permanently.
      </T>

      <T variant="body" tone="faint" style={{ marginTop: SPACE.m, fontSize: 13, lineHeight: 19 }}>
        Reports filed about you are kept for abuse prevention with your identity
        removed. Nothing else survives.
      </T>

      <Field
        label="Type your handle"
        value={typed}
        onChangeText={setTyped}
        placeholder={handle}
        autoCapitalize="none"
        autoCorrect={false}
        size="big"
        good={matches}
        style={{ marginTop: SPACE.xl }}
      />

      <View style={{ marginTop: SPACE.xl }}>
        <Button
          label="Delete my account"
          kind="destructive"
          onPress={destroy}
          disabled={!matches}
          busy={busy}
        />
      </View>

      <T variant="body" tone="faint" style={{ marginTop: SPACE.m, fontSize: 13, lineHeight: 19 }}>
        You can also delete your account at idle.app/delete without the app.
      </T>
    </Screen>
  );
}
