// "IDLE" — the live list.
//
// One fetch, then Realtime. Realtime honours row-level security, so this
// subscription only ever delivers rows the policies already allow: your
// friends, and nobody else.

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "./supabase";
import { getFriends } from "./api";
import type { Agent, Friend } from "./types";

type PresenceRow = {
  user_id: string;
  is_live: boolean;
  agent: Agent | null;
};

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getFriends();
      if (mounted.current) {
        setFriends(next);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "unknown_error");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();

    const channel = supabase
      .channel("presence-of-friends")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "presence" },
        (payload) => {
          const row = payload.new as PresenceRow;
          // A cut, not a fade. BRAND.md §08.
          setFriends((current) =>
            current.map((friend) =>
              friend.user_id === row.user_id
                ? { ...friend, is_live: row.is_live, agent: row.agent }
                : friend,
            ),
          );
        },
      )
      .subscribe();

    // Realtime can miss events while the app is backgrounded; reconcile on
    // return rather than trusting the stream.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
      appState.remove();
    };
  }, [refresh]);

  const live = friends.filter((f) => f.is_live);
  const idle = friends.filter((f) => !f.is_live);

  return { friends, live, idle, loading, error, refresh };
}
