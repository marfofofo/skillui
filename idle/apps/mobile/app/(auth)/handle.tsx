// "IDLE" — you pick the name your friends will see in the list.

import { useState } from "react";
import { TextInput, View, Alert } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { Button } from "@/design/Button";
import { usePalette, SPACE, HAIRLINE } from "@/design/tokens";
import { claimHandle } from "@/lib/api";
import { useSession } from "@/lib/session";

const VALID = /^[a-z0-9_]{3,20}$/;

export default function ChooseHandle() {
  const palette = usePalette();
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
      Alert.alert(
        message.includes("duplicate") || message.includes("unique")
          ? "TAKEN"
          : message.includes("reserved")
            ? "RESERVED"
            : "COULD NOT CLAIM",
        message.includes("duplicate") || message.includes("reserved")
          ? "Pick another one."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Meta>handle</Meta>
        <T variant="title" style={{ marginTop: SPACE.s }}>
          WHAT DO WE CALL YOU
        </T>

        <TextInput
          value={handle}
          onChangeText={(t) => setHandle(t.replace(/[^A-Za-z0-9_]/g, ""))}
          placeholder="marcus"
          placeholderTextColor={palette.concrete}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          autoFocus
          accessibilityLabel="Your handle"
          style={{
            borderBottomWidth: HAIRLINE,
            borderBottomColor: valid ? palette.signal : palette.ink,
            color: palette.ink,
            fontFamily: "InterTight_700Bold",
            fontSize: 40,
            letterSpacing: -1.2,
            textTransform: "uppercase",
            paddingVertical: SPACE.s,
            marginTop: SPACE.l,
          }}
        />

        <T variant="mono" tone="concrete" style={{ marginTop: SPACE.s }}>
          3–20 characters · a–z 0–9 _ · you cannot change it later
        </T>
      </View>

      <View style={{ gap: SPACE.s }}>
        <Button label="That's me" onPress={claim} disabled={!valid} busy={busy} meta="button" />
        <Button label="Sign out" kind="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
