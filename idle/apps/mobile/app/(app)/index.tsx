// "IDLE" — THE LIST.
//
// Not a feed. Not content. People, sorted by whether they are awake.

import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { PresenceRow } from "@/design/PresenceRow";
import { IdleDivider } from "@/design/Hazard";
import { usePalette, SPACE, GUTTER } from "@/design/tokens";
import { useFriends } from "@/lib/presence";
import { getIncomingRequests, getSuggestions } from "@/lib/api";
import type { Friend } from "@/lib/types";

type Row =
  | { kind: "friend"; friend: Friend }
  | { kind: "divider" }
  | { kind: "suggestions"; count: number };

export default function TheList() {
  const palette = usePalette();
  const { live, idle, loading, refresh } = useFriends();
  const [refreshing, setRefreshing] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [suggestionCount, setSuggestionCount] = useState(0);

  const loadBadges = useCallback(async () => {
    try {
      const [requests, suggestions] = await Promise.all([
        getIncomingRequests(),
        getSuggestions(20),
      ]);
      setRequestCount(requests.length);
      setSuggestionCount(suggestions.length);
    } catch {
      // A badge is not worth an error state.
    }
  }, []);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadBadges();
    }, [refresh, loadBadges]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refresh(), loadBadges()]);
    setRefreshing(false);
  }

  const rows: Row[] = [
    ...live.map((friend) => ({ kind: "friend" as const, friend })),
    ...(idle.length > 0 ? [{ kind: "divider" as const }] : []),
    ...idle.map((friend) => ({ kind: "friend" as const, friend })),
    ...(suggestionCount > 0 ? [{ kind: "suggestions" as const, count: suggestionCount }] : []),
  ];

  const nobody = !loading && live.length === 0 && idle.length === 0;

  return (
    <Screen gutter={false}>
      {/* HEADER */}
      <View style={{ paddingHorizontal: GUTTER, marginBottom: SPACE.l }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <T variant="title">&quot;IDLE&quot;</T>
            <T variant="mono" tone="concrete" style={{ marginTop: SPACE.xs }}>
              {live.length > 0
                ? `${live.length} AWAKE`
                : "NOBODY IS BUILDING RIGHT NOW"}
            </T>
          </View>

          <Pressable
            onPress={() => router.push("/(app)/settings")}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
            style={{ paddingLeft: SPACE.m }}
          >
            <Meta>settings</Meta>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: SPACE.l, marginTop: SPACE.m }}>
          <Pressable
            onPress={() => router.push("/(app)/add")}
            accessibilityRole="button"
            accessibilityLabel="Add a friend"
            hitSlop={8}
          >
            <T variant="mono">+ ADD</T>
          </Pressable>

          {requestCount > 0 && (
            <Pressable
              onPress={() => router.push("/(app)/requests")}
              accessibilityRole="button"
              accessibilityLabel={`${requestCount} friend requests`}
              hitSlop={8}
            >
              <T variant="mono" style={{ color: palette.signalOnPaper }}>
                {requestCount} WAITING
              </T>
            </Pressable>
          )}
        </View>
      </View>

      {nobody ? (
        <View style={{ flex: 1, paddingHorizontal: GUTTER, justifyContent: "center" }}>
          {/* BRAND.md §02: not "No friends yet". */}
          <T variant="display" numberOfLines={1} adjustsFontSizeToFit>
            &quot;NOBODY&quot;
          </T>
          <T variant="body" tone="concrete" style={{ marginTop: SPACE.m }}>
            You have to know someone. Send them your code, or scan theirs.
          </T>
          <Pressable
            onPress={() => router.push("/(app)/add")}
            style={{ marginTop: SPACE.l }}
            accessibilityRole="button"
          >
            <T variant="mono" style={{ color: palette.signalOnPaper }}>
              + ADD SOMEONE
            </T>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, index) =>
            row.kind === "friend" ? row.friend.user_id : `${row.kind}-${index}`
          }
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: SPACE.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.concrete}
            />
          }
          renderItem={({ item }) => {
            if (item.kind === "divider") return <IdleDivider />;

            if (item.kind === "suggestions") {
              return (
                <Pressable
                  onPress={() => router.push("/(app)/suggestions")}
                  accessibilityRole="button"
                  style={{ marginTop: SPACE.xl }}
                >
                  <Meta>people you have in common</Meta>
                  <T variant="name" style={{ marginTop: SPACE.xs }}>
                    {item.count} SUGGESTED
                  </T>
                </Pressable>
              );
            }

            return (
              <PresenceRow
                handle={item.friend.handle}
                isLive={item.friend.is_live}
                agent={item.friend.agent}
                onPress={() => router.push(`/(app)/person/${item.friend.user_id}`)}
              />
            );
          }}
        />
      )}
    </Screen>
  );
}
