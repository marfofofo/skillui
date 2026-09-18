// IDLE — /i/K4M7QX29
//
// The other end of every invite link and QR code, on the web build and, through
// universal links, on the phone.

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Button } from "@/design/Button";
import { Lamp } from "@/design/Lamp";
import { SPACE } from "@/design/tokens";
import { lookupInvite, sendFriendRequest, type InvitePreview } from "@/lib/api";
import { useSession } from "@/lib/session";
import { rememberInvite } from "@/lib/invite";

const RESULT: Record<string, string> = {
  self: "That link is yours.",
  friend: "You are already friends.",
  request_sent: "You have already asked.",
  request_received: "They asked you first — accept it from the list.",
  blocked: "That link does not work.",
};

export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, profile, loading } = useSession();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [state, setState] = useState<"looking" | "ready" | "missing" | "done">("looking");
  const [busy, setBusy] = useState(false);

  const signedIn = !!session && !!profile;

  useEffect(() => {
    if (!code || !signedIn) return;
    lookupInvite(code)
      .then((found) => {
        setPreview(found);
        setState(found ? "ready" : "missing");
      })
      .catch(() => setState("missing"));
  }, [code, signedIn]);

  if (loading) return <Screen><View /></Screen>;

  // Hold the code across the sign-in it is about to cause — on web the magic
  // link reloads the page and memory alone would lose it.
  if (!signedIn) {
    if (code) rememberInvite(code);
    return <Redirect href={session ? "/(auth)/handle" : "/(auth)/sign-in"} />;
  }

  async function add() {
    if (!preview) return;
    setBusy(true);
    try {
      await sendFriendRequest(preview.user_id);
      setState("done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen aurora={0.25}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {state === "missing" ? (
          <>
            <T variant="display" tone="asleep">
              No such code
            </T>
            <T variant="body" tone="dim" style={{ marginTop: SPACE.m }}>
              Ask them for a new link.
            </T>
          </>
        ) : state === "done" ? (
          <>
            <Lamp on size={11} />
            <T variant="display" style={{ marginTop: SPACE.l }}>
              Asked
            </T>
            <T variant="body" tone="dim" style={{ marginTop: SPACE.m }}>
              {preview?.handle} has to accept. You will see their light when they do.
            </T>
          </>
        ) : (
          <>
            <Label>Someone shared this with you</Label>
            <T variant="display" style={{ marginTop: SPACE.s }}>
              {preview?.handle ?? "…"}
            </T>
            {preview && preview.relationship !== "none" ? (
              <T variant="body" tone="dim" style={{ marginTop: SPACE.m }}>
                {RESULT[preview.relationship]}
              </T>
            ) : null}
          </>
        )}
      </View>

      <View style={{ gap: SPACE.s }}>
        {state === "ready" && preview?.relationship === "none" && (
          <Button label={`Add ${preview.handle}`} onPress={add} busy={busy} />
        )}
        <Button label="Go to the list" kind="quiet" onPress={() => router.replace("/(app)")} />
      </View>
    </Screen>
  );
}
