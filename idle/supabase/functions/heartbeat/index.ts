// "IDLE" — POST /heartbeat
//
// Four fields and a device token. See docs/PRESENCE_PROTOCOL.md. If this
// function ever starts reading a fifth field, that document is wrong and the
// change needs re-consent in the app.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  bearer,
  fail,
  json,
  parseAgent,
  serviceClientConfig,
  sha256Hex,
} from "../_shared/http.ts";

const EVENTS = new Set(["session_start", "heartbeat", "session_end"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const token = bearer(req);
  if (!token || token.length < 32 || token.length > 128) {
    return fail("unauthorized", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!EVENTS.has(event)) return fail("bad_request", 400);

  const agent = parseAgent(body.agent);

  const { url, key } = serviceClientConfig();
  const db = createClient(url, key, { auth: { persistSession: false } });

  const tokenHash = await sha256Hex(token);

  const { data: allowed, error: limitError } = await db.rpc("rate_limit_hit", {
    p_bucket: "heartbeat",
    p_key: tokenHash,
    p_limit: 60,
    p_window: "01:00:00",
  });
  if (limitError) return fail("server_error", 500);
  if (!allowed) return fail("rate_limited", 429);

  const { data: accepted, error } = await db.rpc("record_heartbeat", {
    p_token_hash: tokenHash,
    p_event: event,
    p_agent: agent,
  });

  if (error) return fail("server_error", 500);
  if (!accepted) return fail("unauthorized", 401);

  return json({ ok: true });
});
