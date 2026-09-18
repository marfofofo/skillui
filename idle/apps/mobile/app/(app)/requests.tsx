import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { Screen } from "@/design/Screen";
import { T } from "@/design/Text";
import { Header } from "@/design/Header";
import { Lamp } from "@/design/Lamp";
import { COLOR, SPACE, ROW_HEIGHT } from "@/design/tokens";
import { getIncomingRequests, respondToRequest } from "@/lib/api";

type Row = Awaited<ReturnType<typeof getIncomingRequests>>[number];

export default function Requests() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getIncomingRequests());
    } catch (e) {
      Alert.alert("Could not load", e instanceof Error ? e.message : "unknown");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(row: Row, accept: boolean) {
    setBusyId(row.id);
    try {
      await respondToRequest(row.id, accept);
      setRows((current) => current.filter((r) => r.id !== row.id));
    } catch (e) {
      Alert.alert("Could not respond", e instanceof Error ? e.message : "unknown");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <Header title="Waiting" />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        ListEmptyComponent={
          <T variant="body" tone="dim">
            Nobody is waiting.
          </T>
        }
        renderItem={({ item }) => (
          <View
            style={{
              height: ROW_HEIGHT,
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.m,
            }}
          >
            <Lamp on={false} />
            <T variant="personSmall" numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.sender?.handle ?? "—"}
            </T>
            <View style={{ flex: 1 }} />

            <Pressable
              onPress={() => respond(item, true)}
              disabled={busyId === item.id}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Accept ${item.sender?.handle}`}
              style={{ paddingHorizontal: SPACE.s }}
            >
              <T variant="mono" tone="text">
                Accept
              </T>
            </Pressable>

            <Pressable
              onPress={() => respond(item, false)}
              disabled={busyId === item.id}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Decline ${item.sender?.handle}`}
              style={{ paddingHorizontal: SPACE.s }}
            >
              <T variant="mono" tone="faint">
                No
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
