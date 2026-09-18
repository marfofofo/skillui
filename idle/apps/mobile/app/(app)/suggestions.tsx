// IDLE — friends of your friends.
//
// The only growth mechanic that reaches new people, and it cannot reach a
// stranger: every name here is one hop from someone you already chose.

import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Lamp } from "@/design/Lamp";
import { COLOR, SPACE, ROW_HEIGHT } from "@/design/tokens";
import { getSuggestions, sendFriendRequest } from "@/lib/api";
import type { Suggestion } from "@/lib/types";

function mutualLine(item: Suggestion) {
  const names = item.mutual_sample;
  if (names.length === 0) return `${item.mutual_count} in common`;
  const extra = item.mutual_count - names.length;
  return extra > 0 ? `${names.join(", ")} +${extra}` : names.join(", ");
}

export default function Suggestions() {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      setRows(await getSuggestions(30));
    } catch (e) {
      Alert.alert("Could not load", e instanceof Error ? e.message : "unknown");
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
      Alert.alert("Could not send", e instanceof Error ? e.message : "unknown");
    }
  }

  return (
    <Screen>
      <Header title="In common" />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.user_id}
        ListEmptyComponent={
          <T variant="body" tone="dim">
            Nobody yet. The graph fills in as your friends add theirs.
          </T>
        }
        renderItem={({ item }) => (
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
              <T variant="name" numberOfLines={1}>
                {item.handle}
              </T>
              <Label style={{ marginTop: SPACE.xs }}>{mutualLine(item)}</Label>
            </View>
            <View style={{ flex: 1 }} />
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
          </View>
        )}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: COLOR.line }} />
        )}
      />
    </Screen>
  );
}
