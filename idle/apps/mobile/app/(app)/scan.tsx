import { useState } from "react";
import { Pressable, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { Button } from "@/design/Button";
import { SPACE, RAW } from "@/design/tokens";
import { lookupInvite, sendFriendRequest } from "@/lib/api";

const CODE_IN_LINK = /(?:idle\.app\/i\/)?([A-Za-z0-9]{8})\s*$/;

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);

  async function onScan(raw: string) {
    if (handled) return;
    setHandled(true);

    const match = raw.trim().match(CODE_IN_LINK);
    if (!match?.[1]) {
      setStatus("THAT IS NOT AN “IDLE” CODE");
      setTimeout(() => setHandled(false), 1500);
      return;
    }

    try {
      const preview = await lookupInvite(match[1]);
      if (!preview) {
        setStatus("NO SUCH CODE");
        setTimeout(() => setHandled(false), 1500);
        return;
      }
      if (preview.relationship !== "none") {
        setStatus(`${preview.handle.toUpperCase()} — ALREADY CONNECTED`);
        return;
      }
      const result = await sendFriendRequest(preview.user_id);
      setStatus(
        result === "friend"
          ? `${preview.handle.toUpperCase()} — YOU ARE FRIENDS`
          : `${preview.handle.toUpperCase()} — REQUEST SENT`,
      );
      setTimeout(() => router.back(), 1200);
    } catch {
      setStatus("SOMETHING WENT WRONG");
      setTimeout(() => setHandled(false), 1500);
    }
  }

  if (!permission) return <Screen><View /></Screen>;

  if (!permission.granted) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Meta>camera</Meta>
          <T variant="title" style={{ marginTop: SPACE.s }}>
            CAMERA OFF
          </T>
          <T variant="body" tone="concrete" style={{ marginTop: SPACE.s }}>
            The camera is used for one thing: reading a friend&apos;s QR code. Nothing
            is stored and no image ever leaves this device.
          </T>
        </View>
        <Button label="Allow camera" onPress={requestPermission} meta="button" />
        <Button
          label="Not now"
          kind="ghost"
          onPress={() => router.back()}
          style={{ marginTop: SPACE.s }}
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: RAW.ink }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACE.l }}>
        <T variant="mono" style={{ color: status ? RAW.signal : RAW.paper }}>
          {status ?? "POINT AT A QR CODE"}
        </T>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          style={{ marginTop: SPACE.m }}
        >
          <T variant="meta" style={{ color: RAW.paper }}>
            &quot;CLOSE&quot;
          </T>
        </Pressable>
      </View>
    </View>
  );
}
