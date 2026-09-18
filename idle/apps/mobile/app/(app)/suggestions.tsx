// "IDLE" — friends of your friends.
//
// The only growth mechanic in the product, and it cannot reach a stranger:
// every name here is one hop from someone you already chose.

import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { usePalette, SPACE, HAIRLINE } from "@/design/tokens";
import { getSuggestions, sendFriendRequest } from "@/lib/api";
import type { Suggestion } from "@/lib/types";

function mutualLine(item: Suggestion) {
  const names = item.mutual_sample.map((h) => h.toUpperCase());
  const extra = item.mutual_count - names.length;
  if (names.length === 0) return `${item.mutual_count} IN COMMON`;
  return extra > 0 ? `${names.join(", ")} +${extra}` : names.join(", ");
}

export default function Suggestions() {
  const palette = usePalette();
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      setRows(await getSuggestions(30));
    } catch (e) {
      Alert.alert("COULD NOT LOAD", e instanceof Error ? e.message : "unknown");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function ask(item: Suggestion) {
    setSent((s) => ({ ...s, [item.user_id]: true }));
    try {
      await sendFriendRequest(item.user_id);
    } catch (e) {
      setSent((s) => ({ ...s, [item.user_id]: false }));
      Alert.alert("COULD NOT SEND", e instanceof Error ? e.message : "unknown");
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T variant="title" style={{ flex: 1 }}>
          IN COMMON
        </T>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Meta>close</Meta>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.user_id}
        style={{ marginTop: SPACE.l }}
        ListEmptyComponent={
          <T variant="body" tone="concrete">
            Nobody yet. The graph fills in as your friends add theirs.
          </T>
        }
        renderItem={({ item }) => (
          <View
            style={{
              paddingVertical: SPACE.m,
              borderBottomWidth: HAIRLINE,
              borderBottomColor: palette.hairline,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <T variant="name" numberOfLines={1}>
                {item.handle}
              </T>
              <T variant="meta" tone="concrete" style={{ marginTop: SPACE.xs }}>
                {mutualLine(item)}
              </T>
            </View>

            <Pressable
              onPress={() => ask(item)}
              disabled={!!sent[item.user_id]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.handle}`}
            >
              <T variant="mono" style={{ color: sent[item.user_id] ? palette.concrete : palette.signalOnPaper }}>
                {sent[item.user_id] ? "ASKED" : "+ ADD"}
              </T>
            </Pressable>
          </View>
        )}
      />
    </Screen>
  );
}
