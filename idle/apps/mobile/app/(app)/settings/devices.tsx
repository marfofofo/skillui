import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Header } from "@/design/Header";
import { Lamp } from "@/design/Lamp";
import { COLOR, SPACE, ROW_HEIGHT } from "@/design/tokens";
import { getDevices, revokeDevice } from "@/lib/api";
import { AGENT_LABEL, type Device } from "@/lib/types";

const RECENT = 8 * 60 * 1000;

function lastSeen(iso: string | null) {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Devices() {
  const [rows, setRows] = useState<Device[]>([]);

  const load = useCallback(async () => {
    try {
      setRows(await getDevices());
    } catch (e) {
      Alert.alert("Could not load", e instanceof Error ? e.message : "unknown");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function confirmRevoke(device: Device) {
    Alert.alert(
      "Revoke this terminal",
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
              Alert.alert("Failed", e instanceof Error ? e.message : "unknown");
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Header title="Devices" />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        ListEmptyComponent={
          <View>
            <T variant="body" tone="dim">
              No terminal is paired. Your friends will never see you awake.
            </T>
            <Pressable
              onPress={() => router.push("/(app)/settings/pair")}
              accessibilityRole="button"
              style={{ marginTop: SPACE.m }}
            >
              <T variant="mono" tone="text">
                Pair one
              </T>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const live = !!item.last_seen_at && Date.now() - new Date(item.last_seen_at).getTime() < RECENT;
          return (
            <View
              style={{
                minHeight: ROW_HEIGHT,
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.m,
              }}
            >
              <Lamp on={live} />
              <View style={{ flexShrink: 1 }}>
                <T variant="personSmall" tone={live ? "text" : "dim"} numberOfLines={1}>
                  {item.label ?? "Unnamed"}
                </T>
                <Label style={{ marginTop: SPACE.xs }}>
                  {`${item.agent ? AGENT_LABEL[item.agent] : "no agent yet"} · ${lastSeen(item.last_seen_at)}`}
                </Label>
              </View>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => confirmRevoke(item)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Revoke ${item.label ?? "device"}`}
                style={{ paddingHorizontal: SPACE.s }}
              >
                <T variant="mono" tone="faint">
                  Revoke
                </T>
              </Pressable>
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
