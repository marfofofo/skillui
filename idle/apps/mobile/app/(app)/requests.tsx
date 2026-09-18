import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { usePalette, SPACE, HAIRLINE } from "@/design/tokens";
import { getIncomingRequests, respondToRequest } from "@/lib/api";

type Row = Awaited<ReturnType<typeof getIncomingRequests>>[number];

export default function Requests() {
  const palette = usePalette();
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getIncomingRequests());
    } catch (e) {
      Alert.alert("COULD NOT LOAD", e instanceof Error ? e.message : "unknown");
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
      Alert.alert("COULD NOT RESPOND", e instanceof Error ? e.message : "unknown");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T variant="title" style={{ flex: 1 }}>
          WAITING
        </T>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Meta>close</Meta>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        style={{ marginTop: SPACE.l }}
        ListEmptyComponent={
          <T variant="body" tone="concrete">
            Nobody is waiting.
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
            <T variant="name" style={{ flex: 1 }} numberOfLines={1}>
              {item.sender?.handle ?? "—"}
            </T>

            <Pressable
              onPress={() => respond(item, true)}
              disabled={busyId === item.id}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Accept ${item.sender?.handle}`}
              style={{ marginRight: SPACE.l }}
            >
              <T variant="mono" style={{ color: palette.signalText }}>
                ACCEPT
              </T>
            </Pressable>

            <Pressable
              onPress={() => respond(item, false)}
              disabled={busyId === item.id}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Decline ${item.sender?.handle}`}
            >
              <T variant="mono" tone="concrete">
                NO
              </T>
            </Pressable>
          </View>
        )}
      />
    </Screen>
  );
}
