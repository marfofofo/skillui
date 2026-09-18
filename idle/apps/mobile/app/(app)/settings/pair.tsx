// "IDLE" — where the phone meets the terminal.

import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { Button } from "@/design/Button";
import { HazardRule } from "@/design/Hazard";
import { usePalette, SPACE, HAIRLINE } from "@/design/tokens";
import { createPairingCode } from "@/lib/api";

function pretty(code: string) {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export default function Pair() {
  const palette = usePalette();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  async function issue() {
    setBusy(true);
    try {
      const result = await createPairingCode();
      setCode(result.code);
      setExpiresAt(new Date(result.expires_at).getTime());
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      Alert.alert(
        message.includes("rate_limited") ? "TOO MANY CODES" : "COULD NOT CREATE",
        message.includes("rate_limited") ? "Wait an hour and try again." : message,
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    issue();
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const command = code ? `npx idle-agent link ${pretty(code)}` : "";

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T variant="title" style={{ flex: 1 }}>
          PAIR A TERMINAL
        </T>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Meta>close</Meta>
        </Pressable>
      </View>

      {/* BRAND.md §07: the third hazard moment — the phone meeting the machine. */}
      <View style={{ marginTop: SPACE.l }}>
        <HazardRule />
      </View>

      <View style={{ marginTop: SPACE.xl, alignItems: "center" }}>
        <Meta>code</Meta>
        <T
          variant="display"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ marginTop: SPACE.s, letterSpacing: -2 }}
        >
          {code ? pretty(code) : "•••-•••"}
        </T>
        <T variant="mono" tone={left > 0 ? "concrete" : "signalText"} style={{ marginTop: SPACE.s }}>
          {left > 0
            ? `EXPIRES IN ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
            : "EXPIRED"}
        </T>
      </View>

      <View style={{ marginTop: SPACE.xxl }}>
        <Meta>run this</Meta>
        <View
          style={{
            borderWidth: HAIRLINE,
            borderColor: palette.ink,
            padding: SPACE.m,
            marginTop: SPACE.xs,
          }}
        >
          <T variant="mono" selectable>
            {command || "—"}
          </T>
        </View>

        <Pressable
          onPress={async () => {
            if (!command) return;
            await Clipboard.setStringAsync(command);
            Alert.alert("COPIED");
          }}
          hitSlop={10}
          accessibilityRole="button"
          style={{ marginTop: SPACE.s }}
        >
          <T variant="mono" tone="concrete">
            COPY COMMAND
          </T>
        </Pressable>
      </View>

      <Button
        label={left > 0 ? "New code" : "Get a code"}
        kind="ghost"
        onPress={issue}
        busy={busy}
        style={{ marginTop: SPACE.xl }}
      />

      <T variant="mono" tone="concrete" style={{ marginTop: SPACE.l, lineHeight: 20 }}>
        The command writes lifecycle hooks into your Claude Code and Codex
        settings. It sends four fields: the event, the agent, the client version
        and a nonce. No paths, no prompts, no code. idle.app/protocol
      </T>
    </Screen>
  );
}
