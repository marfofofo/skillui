// IDLE — the door into the graph.
//
// There is no search box. You cannot find a stranger here: you have their code,
// their link or their QR, or you have nothing. That constraint is the product.

import { useEffect, useState } from "react";
import { Alert, Pressable, Share, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Field } from "@/design/Field";
import { Button } from "@/design/Button";
import { COLOR, SPACE, HAIRLINE, RADIUS } from "@/design/tokens";
import { getMyInviteCode, lookupInvite, sendFriendRequest, type InvitePreview } from "@/lib/api";

const LINK_BASE = "https://idle.app/i/";

const pretty = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

const RELATIONSHIP: Record<string, string> = {
  self: "That's you",
  friend: "Already friends",
  request_sent: "Already asked",
  request_received: "They asked you first — accept it",
  blocked: "Unavailable",
  none: "",
};

export default function AddFriend() {
  const [myCode, setMyCode] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyInviteCode().then(setMyCode).catch(() => setMyCode(null));
  }, []);

  const normalised = typed.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  useEffect(() => {
    if (normalised.length !== 8) {
      setPreview(null);
      return;
    }
    let active = true;
    lookupInvite(normalised)
      .then((found) => active && setPreview(found))
      .catch(() => active && setPreview(null));
    return () => {
      active = false;
    };
  }, [normalised]);

  async function add() {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await sendFriendRequest(preview.user_id);
      Alert.alert(
        result === "friend" ? "You're friends" : "Request sent",
        result === "friend"
          ? `${preview.handle} is in your list.`
          : `${preview.handle} has to accept.`,
      );
      router.back();
    } catch (e) {
      Alert.alert("Could not send", e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header title="Add" />

      <View style={{ alignItems: "center", marginTop: SPACE.m }}>
        <View
          style={{
            padding: SPACE.m,
            backgroundColor: "#FFFFFF",
            borderRadius: RADIUS.panel,
          }}
        >
          {myCode ? (
            <QRCode
              value={`${LINK_BASE}${myCode}`}
              size={184}
              color={COLOR.canvas}
              backgroundColor="#FFFFFF"
            />
          ) : (
            <View style={{ width: 184, height: 184 }} />
          )}
        </View>

        <T variant="title" style={{ marginTop: SPACE.l, letterSpacing: 1.5 }}>
          {myCode ? pretty(myCode) : "········"}
        </T>

        <View style={{ flexDirection: "row", gap: SPACE.l, marginTop: SPACE.m }}>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              if (!myCode) return;
              await Clipboard.setStringAsync(`${LINK_BASE}${myCode}`);
              Alert.alert("Copied");
            }}
          >
            <T variant="mono" tone="dim">
              Copy link
            </T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (!myCode) return;
              Share.share({ message: `Add me on IDLE: ${LINK_BASE}${myCode}` });
            }}
          >
            <T variant="mono" tone="dim">
              Share
            </T>
          </Pressable>
        </View>
      </View>

      <View style={{ height: HAIRLINE, backgroundColor: COLOR.line, marginVertical: SPACE.xl }} />

      <Field
        label="Their code"
        value={typed}
        onChangeText={setTyped}
        placeholder="K4M7-QX29"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={9}
        size="big"
        good={!!preview && preview.relationship === "none"}
      />

      {normalised.length === 8 && !preview && (
        <T variant="mono" tone="faint" style={{ marginTop: SPACE.m }}>
          No such code
        </T>
      )}

      {preview && (
        <View style={{ marginTop: SPACE.m }}>
          <T variant="name">{preview.handle}</T>
          {RELATIONSHIP[preview.relationship] ? (
            <T variant="mono" tone="faint" style={{ marginTop: SPACE.xs }}>
              {RELATIONSHIP[preview.relationship]}
            </T>
          ) : null}
        </View>
      )}

      <Button
        label="Send request"
        onPress={add}
        busy={busy}
        disabled={!preview || preview.relationship !== "none"}
        style={{ marginTop: SPACE.l }}
      />
      <Button
        label="Scan a QR code"
        kind="quiet"
        onPress={() => router.push("/(app)/scan")}
        style={{ marginTop: SPACE.s }}
      />

      <Label style={{ marginTop: SPACE.xl }}>Faster</Label>
      <Button
        label="Find friends from your contacts"
        kind="quiet"
        onPress={() => router.push("/(app)/contacts")}
        style={{ marginTop: SPACE.s }}
      />
      <T variant="body" tone="faint" style={{ marginTop: SPACE.s, fontSize: 13, lineHeight: 19 }}>
        Your contacts are matched on this device and never leave it.
      </T>
    </Screen>
  );
}
