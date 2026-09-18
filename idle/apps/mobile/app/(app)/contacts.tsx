// IDLE — find friends from your contacts.
//
// The screen says what happens, and what happens is what it says: the address
// book is read, hashed and matched on this device. See src/lib/contacts.ts.

import { useState } from "react";
import { Alert, FlatList, Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Button } from "@/design/Button";
import { Lamp } from "@/design/Lamp";
import { COLOR, SPACE, ROW_HEIGHT } from "@/design/tokens";
import { findFriendsInContacts, requestContactsPermission, type Match } from "@/lib/contacts";
import { sendFriendRequest } from "@/lib/api";

type Stage = "intro" | "working" | "done";

const ALREADY: Record<string, string> = {
  friend: "Already friends",
  request_sent: "Asked",
  request_received: "They asked you",
  self: "You",
  blocked: "",
  none: "",
};

export default function Contacts() {
  const [stage, setStage] = useState<Stage>("intro");
  const [matches, setMatches] = useState<Match[]>([]);
  const [scanned, setScanned] = useState(0);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  async function start() {
    const granted = await requestContactsPermission();
    if (!granted) {
      Alert.alert(
        "Contacts off",
        "Nothing happens without this. You can still add friends with a code or a QR.",
      );
      return;
    }

    setStage("working");
    try {
      const result = await findFriendsInContacts();
      setMatches(result.matches);
      setScanned(result.scanned);
      setStage("done");
    } catch (e) {
      setStage("intro");
      Alert.alert("Could not finish", e instanceof Error ? e.message : "unknown");
    }
  }

  async function ask(match: Match) {
    setSent((s) => ({ ...s, [match.user_id]: true }));
    try {
      await sendFriendRequest(match.user_id);
    } catch (e) {
      setSent((s) => ({ ...s, [match.user_id]: false }));
      Alert.alert("Could not send", e instanceof Error ? e.message : "unknown");
    }
  }

  if (stage !== "done") {
    return (
      <Screen>
        <Header />

        <View style={{ flex: 1, justifyContent: "center" }}>
          <T variant="display">Sync your contacts</T>
          <T variant="body" tone="dim" style={{ marginTop: SPACE.m, maxWidth: 300 }}>
            We&apos;ll show you which of the people already in your phone are
            here.
          </T>
        </View>

        <View style={{ gap: SPACE.s }}>
          <Button label="Sync contacts" onPress={start} busy={stage === "working"} />
          <Button label="Not now" kind="quiet" onPress={() => router.back()} />
          <Pressable
            onPress={() => Linking.openURL("https://idle.app/contacts")}
            accessibilityRole="link"
            style={{ alignSelf: "center", padding: SPACE.s }}
          >
            <Label>Your contacts never leave this phone · how</Label>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="From your contacts" />

      <Label style={{ marginBottom: SPACE.s }}>
        {matches.length === 0
          ? `Nobody yet · ${scanned} addresses checked on this device`
          : `${matches.length} of ${scanned} · checked on this device`}
      </Label>

      <FlatList
        data={matches}
        keyExtractor={(row) => row.user_id}
        ListEmptyComponent={
          <T variant="body" tone="dim" style={{ marginTop: SPACE.m }}>
            None of your contacts are here yet. Nothing was kept.
          </T>
        }
        renderItem={({ item }) => {
          const already = ALREADY[item.relationship] ?? "";
          const addable = item.relationship === "none";
          return (
            <View
              style={{
                minHeight: ROW_HEIGHT,
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.m,
              }}
            >
              <Lamp on={false} />
              <View style={{ flexShrink: 1 }}>
                <T variant="personSmall" numberOfLines={1}>
                  {item.handle}
                </T>
                {item.localName ? (
                  <Label style={{ marginTop: SPACE.xs }}>{item.localName}</Label>
                ) : null}
              </View>
              <View style={{ flex: 1 }} />
              {addable ? (
                <Pressable
                  onPress={() => ask(item)}
                  disabled={!!sent[item.user_id]}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.handle}`}
                  style={{ paddingHorizontal: SPACE.s }}
                >
                  <T variant="mono" tone={sent[item.user_id] ? "faint" : "text"}>
                    {sent[item.user_id] ? "Asked" : "Add"}
                  </T>
                </Pressable>
              ) : (
                <T variant="mono" tone="faint">
                  {already}
                </T>
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: COLOR.line }} />
        )}
      />
    </Screen>
  );
}
