import { useState } from "react";
import { View, Alert } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T } from "@/design/Text";
import { Field } from "@/design/Field";
import { Button } from "@/design/Button";
import { SPACE } from "@/design/tokens";
import { claimHandle } from "@/lib/api";
import { useSession } from "@/lib/session";

const VALID = /^[a-z0-9_]{3,20}$/;

export default function ChooseHandle() {
  const { refreshProfile, signOut } = useSession();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const clean = handle.trim().toLowerCase();
  const valid = VALID.test(clean);

  async function claim() {
    setBusy(true);
    try {
      await claimHandle(clean);
      await refreshProfile();
      router.replace("/(app)");
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      const taken = message.includes("duplicate") || message.includes("unique");
      const reserved = message.includes("reserved");
      Alert.alert(
        taken ? "Taken" : reserved ? "Reserved" : "Could not claim",
        taken || reserved ? "Pick another one." : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <T variant="display">What do we call you</T>
        <Field
          label="Handle"
          size="big"
          value={handle}
          onChangeText={(text) => setHandle(text.replace(/[^A-Za-z0-9_]/g, ""))}
          placeholder="marcus"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          autoFocus
          good={valid}
          style={{ marginTop: SPACE.l }}
        />
        <T variant="mono" tone="faint" style={{ marginTop: SPACE.m }}>
          3–20 characters · a–z 0–9 _ · you cannot change it later
        </T>
      </View>

      <View style={{ gap: SPACE.s }}>
        <Button label="That's me" onPress={claim} disabled={!valid} busy={busy} />
        <Button label="Sign out" kind="quiet" onPress={signOut} />
      </View>
    </Screen>
  );
}
