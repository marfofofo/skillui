// IDLE — a person.
//
// Also the App Store Guideline 1.2 surface: report and block are reachable from
// every profile, always, in two taps.

import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Button } from "@/design/Button";
import { COLOR, SPACE, HAIRLINE } from "@/design/tokens";
import { blockUser, getProfile, getRelationship, reportUser, unfriend } from "@/lib/api";
import type { Profile, Relationship, ReportReason } from "@/lib/types";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "impersonation", label: "Pretending to be someone" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "hate", label: "Hate" },
  { value: "other", label: "Something else" },
];

const STATUS: Record<Relationship, string> = {
  friend: "Friends",
  request_sent: "You asked",
  request_received: "They asked you",
  blocked: "Blocked",
  self: "This is you",
  none: "Not connected",
};

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [relationship, setRelationship] = useState<Relationship>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProfile(id).then(setProfile).catch(() => setProfile(null));
    getRelationship(id).then(setRelationship).catch(() => setRelationship("none"));
  }, [id]);

  function run(action: () => Promise<void>, failureTitle: string) {
    return async () => {
      setBusy(true);
      try {
        await action();
        router.back();
      } catch (e) {
        Alert.alert(failureTitle, e instanceof Error ? e.message : "unknown");
      } finally {
        setBusy(false);
      }
    };
  }

  function confirmUnfriend() {
    if (!profile) return;
    Alert.alert(
      `Remove ${profile.handle}`,
      "You will stop seeing each other. You can add them again later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: run(() => unfriend(profile.id), "Could not remove"),
        },
      ],
    );
  }

  function confirmBlock() {
    if (!profile) return;
    Alert.alert(
      `Block ${profile.handle}`,
      "They will not see you, cannot reach you, and will not appear in your suggestions. They are not told.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: run(() => blockUser(profile.id), "Could not block"),
        },
      ],
    );
  }

  function startReport() {
    if (!profile) return;
    Alert.alert(
      `Report ${profile.handle}`,
      "We act on every report within 24 hours. Reporting also blocks them.",
      [
        { text: "Cancel", style: "cancel" },
        ...REASONS.map((reason) => ({
          text: reason.label,
          onPress: run(async () => {
            await reportUser(profile.id, reason.value, undefined, true);
            Alert.alert("Reported", "Thank you. We will look at this within 24 hours.");
          }, "Could not report"),
        })),
      ],
    );
  }

  return (
    <Screen scroll>
      <Header />

      <T variant="display">{profile?.handle ?? "—"}</T>
      {profile?.display_name ? (
        <T variant="body" tone="dim" style={{ marginTop: SPACE.s }}>
          {profile.display_name}
        </T>
      ) : null}
      {profile?.bio ? (
        <T variant="body" style={{ marginTop: SPACE.m }}>
          {profile.bio}
        </T>
      ) : null}

      <Label style={{ marginTop: SPACE.xl }}>Status</Label>
      <T variant="mono" tone="dim" style={{ marginTop: SPACE.xs }}>
        {STATUS[relationship]}
      </T>

      <T variant="body" tone="faint" style={{ marginTop: SPACE.l, fontSize: 13, lineHeight: 19 }}>
        You can see that they are building and which agent they use. Not for how
        long, not on what.
      </T>

      <View
        style={{ height: HAIRLINE, backgroundColor: COLOR.line, marginVertical: SPACE.xl }}
      />

      <View style={{ gap: SPACE.s }}>
        {relationship === "friend" && (
          <Button label="Remove friend" kind="quiet" onPress={confirmUnfriend} busy={busy} />
        )}
        <Button label="Block" kind="quiet" onPress={confirmBlock} busy={busy} />
        <Button label="Report" kind="destructive" onPress={startReport} />
      </View>

      <T variant="body" tone="faint" style={{ marginTop: SPACE.m, fontSize: 13, lineHeight: 19 }}>
        Reports are read by a person and acted on within 24 hours. Blocking is
        immediate, total and silent.
      </T>
    </Screen>
  );
}
