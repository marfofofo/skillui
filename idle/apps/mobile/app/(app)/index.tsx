// IDLE — the list.
//
// Almost no chrome on purpose. The names are the interface; everything else is
// one line of mono at the top and a row of controls at the bottom. What you see
// when you open the app is who is awake, and nothing competing with it.

import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View, useWindowDimensions } from "react-native";
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
  | { kind: "friend"; friend: Friend }
  | { kind: "gap" }
  | { kind: "suggestions"; count: number };

const clock = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function TheList() {
  const { profile } = useSession();
  const { width } = useWindowDimensions();
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
  const nobody = !loading && total === 0;

  const rows: Row[] = [
    ...live.map((friend) => ({ kind: "friend" as const, friend })),
    ...(live.length > 0 && idle.length > 0 ? [{ kind: "gap" as const }] : []),
    ...idle.map((friend) => ({ kind: "friend" as const, friend })),
    ...(suggestionCount > 0 ? [{ kind: "suggestions" as const, count: suggestionCount }] : []),
  ];

  return (
    <Screen gutter={false} aurora={total > 0 ? live.length / total : 0}>
      {/* One line of machine type, and then the people. */}
      <View
        style={{
          paddingHorizontal: GUTTER,
          flexDirection: "row",
          alignItems: "baseline",
        }}
      >
        <Label tone="dim" style={{ letterSpacing: 2.6, flex: 1 }}>
          IDLE
        </Label>
        <Label>{total > 0 ? `${live.length} awake · ${now}` : now}</Label>
      </View>

      {nobody ? (
        <View style={{ flex: 1, paddingHorizontal: GUTTER, justifyContent: "center" }}>
          <T variant="display" tone="asleep">
            Nobody yet
          </T>
          <T variant="body" tone="dim" style={{ marginTop: SPACE.m, maxWidth: 280 }}>
            You have to know someone. Send them your code, scan theirs, or find
            the ones already in your phone.
          </T>
          <Pressable
            onPress={() => router.push("/(app)/add")}
            accessibilityRole="button"
            style={{ marginTop: SPACE.l }}
          >
            <T variant="mono" tone="lamp">
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
          style={{ marginTop: SPACE.xl }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: SPACE.xl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.faint} />
          }
          renderItem={({ item }) => {
            if (item.kind === "gap") return <View style={{ height: SPACE.xl }} />;

            if (item.kind === "suggestions") {
              return (
                <Pressable
                  onPress={() => router.push("/(app)/suggestions")}
                  accessibilityRole="button"
                  style={{ marginTop: SPACE.xxl }}
                >
                  <T variant="personSmall" tone="dim">
                    {item.count} you have people in common with
                  </T>
                </Pressable>
              );
            }

            return (
              <PresenceRow
                handle={item.friend.handle}
                isLive={item.friend.is_live}
                agent={item.friend.agent}
                width={width - GUTTER * 2}
                onPress={() => router.push(`/(app)/person/${item.friend.user_id}`)}
              />
            );
          }}
        />
      )}

      {/* The controls live down here, out of the way of the names. */}
      <View
        style={{
          borderTopWidth: HAIRLINE,
          borderTopColor: COLOR.line,
          paddingHorizontal: GUTTER - SPACE.s,
          paddingTop: SPACE.s,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <IconButton name="plus" label="Add a friend" onPress={() => router.push("/(app)/add")} />
        <IconButton
          name="settings"
          label="Settings"
          onPress={() => router.push("/(app)/settings")}
        />

        {requestCount > 0 && (
          <Pressable
            onPress={() => router.push("/(app)/requests")}
            accessibilityRole="button"
            accessibilityLabel={`${requestCount} friend requests waiting`}
            hitSlop={12}
            style={{ paddingHorizontal: SPACE.s }}
          >
            <T variant="mono" tone="lamp">
              {requestCount} waiting
            </T>
          </Pressable>
        )}

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => router.push(me?.is_live ? "/(app)/settings/devices" : "/(app)/settings/pair")}
          accessibilityRole="button"
          accessibilityLabel={me?.is_live ? "Your terminals" : "Pair a terminal"}
          style={{ flexDirection: "row", alignItems: "center", gap: SPACE.s, paddingHorizontal: SPACE.s }}
        >
          <Lamp on={!!me?.is_live} size={6} />
          <Label tone={me?.is_live ? "faint" : "asleep"} numberOfLines={1}>
            {me?.is_live
              ? `${profile?.handle ?? "you"} · ${AGENT_LABEL[me.agent ?? "claude_code"]}`
              : "pair a terminal"}
          </Label>
        </Pressable>
      </View>
    </Screen>
  );
}
