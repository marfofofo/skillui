// IDLE — the list.
//
// Not a feed. Not content. People, and which of them are awake.

import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Lamp } from "@/design/Lamp";
import { IconButton } from "@/design/Icon";
import { PresenceRow } from "@/design/PresenceRow";
import { COLOR, SPACE, GUTTER, HAIRLINE } from "@/design/tokens";
import { useFriends } from "@/lib/presence";
import { getIncomingRequests, getMyPresence, getSuggestions } from "@/lib/api";
import { AGENT_LABEL, type Agent, type Friend } from "@/lib/types";
import { useSession } from "@/lib/session";

type Row =
  | { kind: "section"; label: string }
  | { kind: "friend"; friend: Friend }
  | { kind: "rule" }
  | { kind: "suggestions"; count: number };

function clock() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TheList() {
  const { profile } = useSession();
  const { live, idle, loading, refresh } = useFriends();
  const [refreshing, setRefreshing] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [me, setMe] = useState<{ is_live: boolean; agent: Agent | null } | null>(null);
  const [now, setNow] = useState(clock);

  const loadBadges = useCallback(async () => {
    try {
      const [requests, suggestions, mine] = await Promise.all([
        getIncomingRequests(),
        getSuggestions(20),
        getMyPresence(),
      ]);
      setRequestCount(requests.length);
      setSuggestionCount(suggestions.length);
      setMe(mine);
    } catch {
      // A badge is not worth an error state.
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(clock()), 30_000);
    return () => clearInterval(timer);
  }, []);

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

  const total = live.length + idle.length;

  const rows: Row[] = [
    ...(live.length > 0
      ? ([{ kind: "section", label: "Awake" }] as Row[]).concat(
          live.map((friend) => ({ kind: "friend" as const, friend })),
        )
      : []),
    ...(idle.length > 0
      ? ([{ kind: "rule" }, { kind: "section", label: "Idle" }] as Row[]).concat(
          idle.map((friend) => ({ kind: "friend" as const, friend })),
        )
      : []),
    ...(suggestionCount > 0
      ? [{ kind: "suggestions" as const, count: suggestionCount }]
      : []),
  ];

  const nobody = !loading && total === 0;

  return (
    <Screen gutter={false}>
      <View style={{ paddingHorizontal: GUTTER }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <T variant="mono" tone="text" style={{ letterSpacing: 2.4, flex: 1 }}>
            IDLE
          </T>
          <IconButton name="plus" label="Add a friend" onPress={() => router.push("/(app)/add")} />
          <IconButton
            name="settings"
            label="Settings"
            onPress={() => router.push("/(app)/settings")}
          />
        </View>

        <View style={{ marginTop: SPACE.xl }}>
          <T variant="display">
            {live.length === 0 ? "Nobody yet" : `${live.length} awake`}
          </T>
          <T variant="mono" tone="faint" style={{ marginTop: SPACE.m }}>
            {total > 0 ? `of ${total} · ${now}` : now}
          </T>
        </View>

        {requestCount > 0 && (
          <Pressable
            onPress={() => router.push("/(app)/requests")}
            accessibilityRole="button"
            accessibilityLabel={`${requestCount} friend requests waiting`}
            style={{ marginTop: SPACE.l, flexDirection: "row", alignItems: "center", gap: SPACE.s }}
          >
            <T variant="mono" tone="text">
              {requestCount} waiting
            </T>
          </Pressable>
        )}
      </View>

      {nobody ? (
        <View style={{ flex: 1, paddingHorizontal: GUTTER, justifyContent: "center" }}>
          <T variant="body" tone="dim">
            You have to know someone. Send them your code, or scan theirs.
          </T>
          <Pressable
            onPress={() => router.push("/(app)/add")}
            accessibilityRole="button"
            style={{ marginTop: SPACE.l }}
          >
            <T variant="mono" tone="text">
              Add someone
            </T>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, index) =>
            row.kind === "friend" ? row.friend.user_id : `${row.kind}-${index}`
          }
          style={{ marginTop: SPACE.l }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: SPACE.xxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.faint} />
          }
          renderItem={({ item }) => {
            if (item.kind === "rule") {
              return (
                <View
                  style={{
                    height: HAIRLINE,
                    backgroundColor: COLOR.line,
                    marginTop: SPACE.l,
                  }}
                />
              );
            }
            if (item.kind === "section") {
              return <Label style={{ paddingTop: SPACE.l, paddingBottom: SPACE.s }}>{item.label}</Label>;
            }
            if (item.kind === "suggestions") {
              return (
                <Pressable
                  onPress={() => router.push("/(app)/suggestions")}
                  accessibilityRole="button"
                  style={{ marginTop: SPACE.xl }}
                >
                  <Label>People you have in common</Label>
                  <T variant="name" style={{ marginTop: SPACE.s }}>
                    {item.count} suggested
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

      {/* You, at the bottom, the way a terminal shows your own prompt. */}
      <View
        style={{
          borderTopWidth: HAIRLINE,
          borderTopColor: COLOR.line,
          backgroundColor: COLOR.raise,
          paddingHorizontal: GUTTER,
          paddingVertical: SPACE.m,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.m,
        }}
      >
        <Lamp on={!!me?.is_live} />
        <T variant="mono" tone="dim" numberOfLines={1} style={{ flexShrink: 1 }}>
          {me?.is_live
            ? `${profile?.handle ?? "you"} · ${AGENT_LABEL[me.agent ?? "claude_code"]}`
            : `${profile?.handle ?? "you"} · idle`}
        </T>
        <View style={{ flex: 1 }} />
        {!me?.is_live && (
          <Pressable
            onPress={() => router.push("/(app)/settings/pair")}
            accessibilityRole="button"
            accessibilityLabel="Pair a terminal"
          >
            <T variant="mono" tone="text">
              Pair
            </T>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}
