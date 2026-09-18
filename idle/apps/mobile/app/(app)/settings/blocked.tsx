import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { Screen } from "@/design/Screen";
import { T } from "@/design/Text";
import { Header } from "@/design/Header";
import { COLOR, SPACE, ROW_HEIGHT } from "@/design/tokens";
import { getMyBlocks, unblockUser, type BlockedPerson } from "@/lib/api";

export default function Blocked() {
  const [rows, setRows] = useState<BlockedPerson[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getMyBlocks());
    } catch (e) {
      Alert.alert("Could not load", e instanceof Error ? e.message : "unknown");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function confirmUnblock(person: BlockedPerson) {
    Alert.alert(
      `Unblock ${person.handle}`,
      "They will be able to find you and send you a request again. You are not friends again — the friendship was removed when you blocked them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setBusyId(person.user_id);
            try {
              await unblockUser(person.user_id);
              setRows((current) => current.filter((r) => r.user_id !== person.user_id));
            } catch (e) {
              Alert.alert("Failed", e instanceof Error ? e.message : "unknown");
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Header title="Blocked" />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.user_id}
        ListEmptyComponent={
          <T variant="body" tone="dim">
            You have not blocked anyone.
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
            <T variant="personSmall" tone="dim" numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.handle}
            </T>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => confirmUnblock(item)}
              disabled={busyId === item.user_id}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${item.handle}`}
              style={{ paddingHorizontal: SPACE.s }}
            >
              <T variant="mono" tone="text">
                Unblock
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
