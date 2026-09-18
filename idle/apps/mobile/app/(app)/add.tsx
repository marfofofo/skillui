// "IDLE" — the door into the graph.
//
// The 3% (BRAND.md §02): there is no search box. You cannot find a stranger
// here. You have their code, or their QR, or you have nothing.

import { useEffect, useState } from "react";
import { Alert, Pressable, Share, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { Button } from "@/design/Button";
import { usePalette, SPACE, HAIRLINE, RAW } from "@/design/tokens";
import { getMyInviteCode, lookupInvite, sendFriendRequest, type InvitePreview } from "@/lib/api";

const LINK_BASE = "https://idle.app/i/";

function pretty(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export default function AddFriend() {
  const palette = usePalette();
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
      .then((found) => {
        if (active) setPreview(found);
      })
      .catch(() => {
        if (active) setPreview(null);
      });
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
        result === "friend" ? "YOU ARE FRIENDS" : "REQUEST SENT",
        result === "friend"
          ? `${preview.handle.toUpperCase()} is in your list.`
          : `${preview.handle.toUpperCase()} has to accept.`,
      );
      router.back();
    } catch (e) {
      Alert.alert("COULD NOT SEND", e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  const relationshipLabel: Record<string, string> = {
    self: "THAT IS YOU",
    friend: "ALREADY FRIENDS",
    request_sent: "ALREADY ASKED",
    request_received: "THEY ASKED YOU FIRST — ACCEPT",
    blocked: "UNAVAILABLE",
    none: "",
  };

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T variant="title" style={{ flex: 1 }}>
          ADD
        </T>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Meta>close</Meta>
        </Pressable>
      </View>

      {/* YOUR CODE */}
      <View style={{ marginTop: SPACE.xl, alignItems: "center" }}>
        <Meta>qr code</Meta>
        <View
          style={{
            backgroundColor: RAW.paper,
            padding: SPACE.m,
            marginTop: SPACE.s,
            borderWidth: HAIRLINE,
            borderColor: palette.hairline,
          }}
        >
          {myCode ? (
            <QRCode
              value={`${LINK_BASE}${myCode}`}
              size={196}
              color={RAW.ink}
              backgroundColor={RAW.paper}
            />
          ) : (
            <View style={{ width: 196, height: 196 }} />
          )}
        </View>

        <T variant="title" style={{ marginTop: SPACE.m, letterSpacing: 2 }}>
          {myCode ? pretty(myCode) : "--------"}
        </T>

        <View style={{ flexDirection: "row", gap: SPACE.l, marginTop: SPACE.s }}>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              if (!myCode) return;
              await Clipboard.setStringAsync(`${LINK_BASE}${myCode}`);
              Alert.alert("COPIED");
            }}
          >
            <T variant="mono" tone="concrete">
              COPY LINK
            </T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (!myCode) return;
              Share.share({ message: `Add me on "IDLE": ${LINK_BASE}${myCode}` });
            }}
          >
            <T variant="mono" tone="concrete">
              SHARE
            </T>
          </Pressable>
        </View>
      </View>

      {/* THEIR CODE */}
      <View style={{ marginTop: SPACE.xxl }}>
        <Meta>their code</Meta>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          placeholder="K4M7-QX29"
          placeholderTextColor={palette.concrete}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          accessibilityLabel="Your friend's invite code"
          style={{
            borderBottomWidth: HAIRLINE,
            borderBottomColor: preview ? palette.signal : palette.ink,
            color: palette.ink,
            fontFamily: "InterTight_700Bold",
            fontSize: 32,
            letterSpacing: 2,
            paddingVertical: SPACE.s,
            marginTop: SPACE.xs,
          }}
        />

        {normalised.length === 8 && !preview && (
          <T variant="mono" tone="concrete" style={{ marginTop: SPACE.s }}>
            NO SUCH CODE
          </T>
        )}

        {preview && (
          <View style={{ marginTop: SPACE.m }}>
            <T variant="name">{preview.handle}</T>
            {relationshipLabel[preview.relationship] ? (
              <T variant="mono" tone="concrete" style={{ marginTop: SPACE.xs }}>
                {relationshipLabel[preview.relationship]}
              </T>
            ) : null}
          </View>
        )}

        <Button
          label="Send request"
          onPress={add}
          busy={busy}
          disabled={!preview || preview.relationship !== "none"}
          meta="button"
          style={{ marginTop: SPACE.m }}
        />

        <Button
          label="Scan a QR code"
          kind="ghost"
          onPress={() => router.push("/(app)/scan")}
          style={{ marginTop: SPACE.s }}
        />
      </View>
    </Screen>
  );
}
