import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { usePalette, SPACE, HAIRLINE } from "@/design/tokens";
import { getDevices, revokeDevice } from "@/lib/api";
import { AGENT_LABEL, type Device } from "@/lib/types";

function lastSeen(iso: string | null) {
  if (!iso) return "NEVER";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes}M AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  return `${Math.round(hours / 24)}D AGO`;
}

export default function Devices() {
  const palette = usePalette();
  const [rows, setRows] = useState<Device[]>([]);

  const load = useCallback(async () => {
    try {
      setRows(await getDevices());
    } catch (e) {
      Alert.alert("COULD NOT LOAD", e instanceof Error ? e.message : "unknown");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function confirmRevoke(device: Device) {
    Alert.alert(
      "REVOKE THIS TERMINAL",
      "Its token stops working immediately. Run `idle unlink` on that machine to remove the hooks too.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await revokeDevice(device.id);
              setRows((current) => current.filter((d) => d.id !== device.id));
            } catch (e) {
              Alert.alert("FAILED", e instanceof Error ? e.message : "unknown");
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T variant="title" style={{ flex: 1 }}>
          DEVICES
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
          <View>
            <T variant="body" tone="concrete">
              No terminal is paired. Your friends will never see you awake.
            </T>
            <Pressable
              onPress={() => router.push("/(app)/settings/pair")}
              style={{ marginTop: SPACE.m }}
              accessibilityRole="button"
            >
              <T variant="mono" style={{ color: palette.signalText }}>
                PAIR ONE
              </T>
            </Pressable>
          </View>
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
                {item.label ?? "UNNAMED"}
              </T>
              <T variant="meta" tone="concrete" style={{ marginTop: SPACE.xs }}>
                {`${item.agent ? AGENT_LABEL[item.agent] : "NO AGENT YET"} · ${lastSeen(item.last_seen_at)}`}
              </T>
            </View>

            <Pressable
              onPress={() => confirmRevoke(item)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Revoke ${item.label ?? "device"}`}
            >
              <T variant="mono" tone="concrete">
                REVOKE
              </T>
            </Pressable>
          </View>
        )}
      />
    </Screen>
  );
}
