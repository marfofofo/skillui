// "IDLE" — POST /pair
//
// A terminal exchanges a 6-character pairing code, shown once in the app, for a
// device token. This is the only moment a token exists in plaintext anywhere
// but the terminal's own disk.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  clientIp,
  fail,
  json,
  newDeviceToken,
  parseAgent,
  serviceClientConfig,
  sha256Hex,
} from "../_shared/http.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 6) {
    return fail("invalid_code", 400);
  }

  const label = typeof body.label === "string" ? body.label.slice(0, 60) : null;
  const agent = parseAgent(body.agent);

  const { url, key } = serviceClientConfig();
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 10 redemption attempts per hour per IP. The key is hashed so the table
  // never holds a readable address.
  const ipKey = await sha256Hex(clientIp(req));
  const { data: allowed, error: limitError } = await db.rpc("rate_limit_hit", {
    p_bucket: "pair",
    p_key: ipKey,
    p_limit: 10,
    p_window: "01:00:00",
  });
  if (limitError) return fail("server_error", 500);
  if (!allowed) return fail("rate_limited", 429);

  const token = newDeviceToken();
  const tokenHash = await sha256Hex(token);

  const { data, error } = await db.rpc("pair_device", {
    p_code: code,
    p_token_hash: tokenHash,
    p_label: label,
    p_agent: agent,
  });

  if (error) {
    // invalid, expired or already-used codes are indistinguishable on purpose.
    return fail("invalid_code", 400);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return json({
    token,
    device_id: row?.device_id ?? null,
    handle: row?.handle ?? null,
  });
});
