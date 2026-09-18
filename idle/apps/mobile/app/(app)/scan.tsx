import { useState } from "react";
import { View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T } from "@/design/Text";
import { Button } from "@/design/Button";
import { IconButton } from "@/design/Icon";
import { COLOR, SPACE } from "@/design/tokens";
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
      setStatus("That is not an IDLE code");
      setTimeout(() => setHandled(false), 1500);
      return;
    }

    try {
      const preview = await lookupInvite(match[1]);
      if (!preview) {
        setStatus("No such code");
        setTimeout(() => setHandled(false), 1500);
        return;
      }
      if (preview.relationship !== "none") {
        setStatus(`${preview.handle} — already connected`);
        return;
      }
      const result = await sendFriendRequest(preview.user_id);
      setStatus(
        result === "friend"
          ? `${preview.handle} — you're friends`
          : `${preview.handle} — request sent`,
      );
      setTimeout(() => router.back(), 1200);
    } catch {
      setStatus("Something went wrong");
      setTimeout(() => setHandled(false), 1500);
    }
  }

  if (!permission) {
    return (
      <Screen>
        <View />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <T variant="title">Camera off</T>
          <T variant="body" tone="dim" style={{ marginTop: SPACE.m }}>
            The camera is used for one thing: reading a friend&apos;s QR code.
            Nothing is stored and no image ever leaves this device.
          </T>
        </View>
        <Button label="Allow camera" onPress={requestPermission} />
        <Button
          label="Not now"
          kind="quiet"
          onPress={() => router.back()}
          style={{ marginTop: SPACE.s }}
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.canvas }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />

      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: SPACE.xxl,
          paddingHorizontal: SPACE.m,
          flexDirection: "row",
        }}
      >
        <View style={{ flex: 1 }} />
        <IconButton name="close" label="Close" tone="text" onPress={() => router.back()} />
      </View>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACE.l }}>
        <T variant="mono" tone={status ? "text" : "dim"}>
          {status ?? "Point at a QR code"}
        </T>
      </View>
    </View>
  );
}
