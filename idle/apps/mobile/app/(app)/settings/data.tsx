// IDLE — GDPR Art. 20, as a button rather than a support ticket.

import { useState } from "react";
import { Alert, View } from "react-native";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Button } from "@/design/Button";
import { SPACE } from "@/design/tokens";
import { exportMyData } from "@/lib/api";
import { offerFile } from "@/lib/download";
import { useSession } from "@/lib/session";

export default function YourData() {
  const { profile } = useSession();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const data = await exportMyData();
      const stamp = new Date().toISOString().slice(0, 10);
      const how = await offerFile(
        `idle-${profile?.handle ?? "export"}-${stamp}.json`,
        JSON.stringify(data, null, 2),
      );
      if (how === "unavailable") {
        Alert.alert("Nowhere to send it", "This device has no way to share a file.");
      }
    } catch (e) {
      Alert.alert("Could not export", e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header title="Your data" />

      <T variant="body" tone="dim">
        Everything we hold about you, in one file, right now. No request, no wait.
      </T>

      <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>What is in it</Label>
      <T variant="body" tone="dim" style={{ fontSize: 15, lineHeight: 24 }}>
        Your account and profile, your settings, your invite code, your current
        presence, every terminal you have paired, every friendship and request,
        everyone you have blocked, and the salted hash of your own email address.
      </T>

      <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>What is not</Label>
      <T variant="body" tone="faint" style={{ fontSize: 15, lineHeight: 24 }}>
        There is no history of when you were awake, because none is kept — presence
        is a current state and nothing else. No working directories, repository
        names, prompts, code or tool output. No contacts: matching happens on your
        device and we never receive them. No location, no advertising identifiers,
        no third-party analytics.
      </T>

      <T variant="body" tone="faint" style={{ marginTop: SPACE.l, fontSize: 13, lineHeight: 19 }}>
        The file says the same thing, in a field called not_held, so it is checkable
        rather than a claim on a page.
      </T>

      <View style={{ marginTop: SPACE.xl }}>
        <Button label="Download my data" onPress={download} busy={busy} />
      </View>
    </Screen>
  );
}
