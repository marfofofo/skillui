// IDLE — two notifications, and a page that says so.

import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Switch } from "@/design/Switch";
import { SPACE } from "@/design/tokens";
import { getMySettings, updateMySettings, type Settings } from "@/lib/api";
import { registerForPush, PUSH_SUPPORTED } from "@/lib/push";

export default function NotificationSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSettings(await getMySettings());
    } catch (e) {
      Alert.alert("Could not load", e instanceof Error ? e.message : "unknown");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function set(field: keyof Settings, value: boolean) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [field]: value });
    setBusy(true);
    try {
      // Asking for permission at the moment someone switches something on is the
      // only honest time to ask: the reason is on screen.
      if (value && (field === "notify_on_request" || field === "notify_on_friend_live")) {
        const granted = await registerForPush();
        if (!granted && PUSH_SUPPORTED) {
          setSettings(previous);
          Alert.alert(
            "Notifications are off",
            "Turn them on for IDLE in your device settings, then come back.",
          );
          return;
        }
      }
      await updateMySettings({ [field]: value });
    } catch (e) {
      setSettings(previous);
      Alert.alert("Could not save", e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header title="Notifications" />

      {!PUSH_SUPPORTED && (
        <T variant="body" tone="faint" style={{ marginBottom: SPACE.l, fontSize: 13 }}>
          These only work in the app on a phone. The switches still save.
        </T>
      )}

      <Label style={{ marginBottom: SPACE.s }}>We will buzz you for</Label>

      <Switch
        label="Someone asks to be your friend"
        value={settings?.notify_on_request ?? true}
        onChange={(v) => set("notify_on_request", v)}
        disabled={busy || !settings}
      />

      <Switch
        label="A friend starts building"
        description="At most once per friend every six hours, and five a day in total. Off unless you ask for it."
        value={settings?.notify_on_friend_live ?? false}
        onChange={(v) => set("notify_on_friend_live", v)}
        disabled={busy || !settings}
      />

      <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>Being found</Label>

      <Switch
        label="People who have your email can find you"
        description="Only people who already have your address, and only from their own device."
        value={settings?.discoverable_by_contact ?? true}
        onChange={(v) => set("discoverable_by_contact", v)}
        disabled={busy || !settings}
      />

      <T variant="body" tone="faint" style={{ marginTop: SPACE.xl, fontSize: 13, lineHeight: 20 }}>
        That is the whole list. There is no digest, no weekly summary and nothing
        that exists to get you to open the app again. If a third kind of
        notification ever appears here, something has gone wrong.
      </T>
    </Screen>
  );
}
