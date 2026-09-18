// IDLE — where the phone meets the machine.

import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Button } from "@/design/Button";
import { COLOR, SPACE, HAIRLINE, RADIUS } from "@/design/tokens";
import { FAMILY } from "@/design/type";
import { createPairingCode } from "@/lib/api";

const pretty = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

export default function Pair() {
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
        message.includes("rate_limited") ? "Too many codes" : "Could not create",
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
      <Header title="Pair a terminal" />

      <View style={{ alignItems: "center", marginTop: SPACE.l }}>
        <Label>Code</Label>
        <T
          style={{
            fontFamily: FAMILY.light,
            fontSize: 56,
            lineHeight: 60,
            letterSpacing: 2,
            marginTop: SPACE.s,
          }}
        >
          {code ? pretty(code) : "···-···"}
        </T>
        <T variant="mono" tone={left > 0 ? "faint" : "dim"} style={{ marginTop: SPACE.m }}>
          {left > 0
            ? `expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
            : "expired"}
        </T>
      </View>

      <Label style={{ marginTop: SPACE.xxl }}>Run this</Label>
      <View
        style={{
          borderWidth: HAIRLINE,
          borderColor: COLOR.line,
          backgroundColor: COLOR.raise,
          borderRadius: RADIUS.row,
          padding: SPACE.m,
          marginTop: SPACE.s,
        }}
      >
        <T
          selectable
          style={{ fontFamily: FAMILY.mono, fontSize: 13, color: COLOR.text }}
        >
          {command || "—"}
        </T>
      </View>

      <Pressable
        onPress={async () => {
          if (!command) return;
          await Clipboard.setStringAsync(command);
          Alert.alert("Copied");
        }}
        hitSlop={12}
        accessibilityRole="button"
        style={{ marginTop: SPACE.m }}
      >
        <T variant="mono" tone="dim">
          Copy command
        </T>
      </Pressable>

      <Button
        label={left > 0 ? "New code" : "Get a code"}
        kind="quiet"
        onPress={issue}
        busy={busy}
        style={{ marginTop: SPACE.xl }}
      />

      <T variant="body" tone="faint" style={{ marginTop: SPACE.l, fontSize: 13, lineHeight: 19 }}>
        The command writes lifecycle hooks into your Claude Code and Codex
        settings. It sends four fields: the event, the agent, the client version
        and a nonce. No paths, no prompts, no code. idle.app/protocol
      </T>
    </Screen>
  );
}
