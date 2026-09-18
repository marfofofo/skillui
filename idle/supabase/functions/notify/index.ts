// IDLE — POST /notify
//
// Drains the outbox and hands it to Expo's push service. Runs on a schedule
// rather than on the path of anyone's action: a slow push service must never be
// able to slow down accepting a friend or starting a coding session.
//
// Called by pg_cron through pg_net. It carries no user session, so it is
// deployed without JWT verification and authenticates on a shared secret
// instead — see docs/SETUP.md.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { fail, json, serviceClientConfig } from "../_shared/http.ts";

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const BATCH = 100;

type Claimed = {
  id: string;
  kind: "friend_request" | "friend_live";
  payload: { handle?: string; agent?: string | null };
  tokens: string[];
};

/** The whole of what this product will ever say to a lock screen. */
function compose(row: Claimed) {
  const handle = row.payload.handle ?? "someone";
  return row.kind === "friend_request"
    ? { title: handle, body: "wants to be friends" }
    : { title: handle, body: "is building" };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const expected = Deno.env.get("IDLE_CRON_SECRET");
  if (!expected || req.headers.get("x-idle-cron-secret") !== expected) {
    return fail("unauthorized", 401);
  }

  const { url, key } = serviceClientConfig();
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await db.rpc("claim_notifications", { p_limit: BATCH });
  if (error) return fail("server_error", 500);

  const rows = (data ?? []) as Claimed[];
  if (rows.length === 0) return json({ sent: 0, dropped: 0 });

  // Nobody to deliver to is not a failure — it is someone who never turned
  // notifications on, or signed out. Close it rather than retrying twice more.
  const undeliverable = rows.filter((row) => row.tokens.length === 0).map((row) => row.id);
  const deliverable = rows.filter((row) => row.tokens.length > 0);

  const messages = deliverable.flatMap((row) => {
    const { title, body } = compose(row);
    return row.tokens.map((to) => ({
      to,
      title,
      body,
      sound: null,
      priority: "normal",
      channelId: "default",
      data: { kind: row.kind },
    }));
  });

  let delivered: string[] = [];
  let failure: string | null = null;

  if (messages.length > 0) {
    try {
      const response = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (response.ok) {
        delivered = deliverable.map((row) => row.id);
      } else {
        failure = `expo_${response.status}`;
      }
    } catch (e) {
      failure = e instanceof Error ? e.message.slice(0, 200) : "network";
    }
  }

  if (undeliverable.length > 0) {
    await db.rpc("mark_notifications_sent", { p_ids: undeliverable });
  }
  if (delivered.length > 0) {
    await db.rpc("mark_notifications_sent", { p_ids: delivered });
  }
  if (failure) {
    // Left unsent, with the reason recorded. claim_notifications gives up after
    // three attempts, so a push service that is down cannot loop forever.
    await db.rpc("mark_notifications_sent", {
      p_ids: deliverable.map((row) => row.id),
      p_error: failure,
    });
  }

  return json({ sent: delivered.length, dropped: undeliverable.length, failure });
});
