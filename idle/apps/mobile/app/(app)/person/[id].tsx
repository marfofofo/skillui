// "IDLE" — a person.
//
// Also the App Store Guideline 1.2 surface: report and block are reachable
// from every profile, always, in two taps.

import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { Button } from "@/design/Button";
import { HazardRule } from "@/design/Hazard";
import { usePalette, SPACE } from "@/design/tokens";
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

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [relationship, setRelationship] = useState<Relationship>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProfile(id).then(setProfile).catch(() => setProfile(null));
    getRelationship(id).then(setRelationship).catch(() => setRelationship("none"));
  }, [id]);

  function confirmUnfriend() {
    if (!profile) return;
    Alert.alert(
      `REMOVE ${profile.handle.toUpperCase()}`,
      "You will stop seeing each other. You can add them again later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await unfriend(profile.id);
              router.back();
            } catch (e) {
              Alert.alert("FAILED", e instanceof Error ? e.message : "unknown");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  function confirmBlock() {
    if (!profile) return;
    Alert.alert(
      `BLOCK ${profile.handle.toUpperCase()}`,
      "They will not see you, cannot reach you, and will not appear in your suggestions. They are not told.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await blockUser(profile.id);
              router.back();
            } catch (e) {
              Alert.alert("FAILED", e instanceof Error ? e.message : "unknown");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  function startReport() {
    if (!profile) return;
    Alert.alert(
      `REPORT ${profile.handle.toUpperCase()}`,
      "We act on every report within 24 hours. Reporting also blocks them.",
      [
        { text: "Cancel", style: "cancel" },
        ...REASONS.map((reason) => ({
          text: reason.label,
          onPress: async () => {
            try {
              await reportUser(profile.id, reason.value, undefined, true);
              Alert.alert("REPORTED", "Thank you. We will look at this within 24 hours.");
              router.back();
            } catch (e) {
              Alert.alert("FAILED", e instanceof Error ? e.message : "unknown");
            }
          },
        })),
      ],
    );
  }

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Meta>close</Meta>
        </Pressable>
      </View>

      <View style={{ marginTop: SPACE.xl }}>
        <T variant="display" numberOfLines={1} adjustsFontSizeToFit>
          {profile?.handle ?? "—"}
        </T>
        {profile?.display_name ? (
          <T variant="body" tone="concrete" style={{ marginTop: SPACE.s }}>
            {profile.display_name}
          </T>
        ) : null}
        {profile?.bio ? (
          <T variant="body" style={{ marginTop: SPACE.m }}>
            {profile.bio}
          </T>
        ) : null}

        <Meta style={{ marginTop: SPACE.xl }}>status</Meta>
        <T variant="mono" tone="concrete" style={{ marginTop: SPACE.xs }}>
          {relationship === "friend"
            ? "FRIENDS"
            : relationship === "request_sent"
              ? "YOU ASKED"
              : relationship === "request_received"
                ? "THEY ASKED YOU"
                : "NOT CONNECTED"}
        </T>

        <T variant="mono" tone="concrete" style={{ marginTop: SPACE.l, lineHeight: 20 }}>
          You can see that they are building and which agent they use. Not for how
          long, not on what.
        </T>
      </View>

      {/* BRAND.md §07: a hazard rule marks a boundary you are crossing. */}
      <View style={{ marginTop: SPACE.xxl }}>
        <HazardRule />
      </View>

      <View style={{ marginTop: SPACE.l, gap: SPACE.s }}>
        {relationship === "friend" && (
          <Button label="Remove friend" kind="ghost" onPress={confirmUnfriend} busy={busy} />
        )}
        <Button label="Block" kind="ghost" onPress={confirmBlock} busy={busy} meta="block" />
        <Button label="Report" kind="destructive" onPress={startReport} meta="report" />
        <T variant="mono" tone="concrete" style={{ marginTop: SPACE.s, lineHeight: 20 }}>
          Reports are read by a person and acted on within 24 hours. Blocking is
          immediate, total, and silent.
        </T>
      </View>
    </Screen>
  );
}
