// "IDLE" — shared edge-function plumbing.

export const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function fail(code: string, status: number): Response {
  return json({ error: code }, status);
}

/** SHA-256 of a device token, lowercase hex. The token itself is never stored. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 32 random bytes, base64url. Returned to the terminal once and never again. */
export function newDeviceToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function bearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Best-effort client IP for rate limiting. Never logged, never stored beyond
 * the rate-limit key, which is itself hashed.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

export const AGENTS = ["claude_code", "codex"] as const;
export type Agent = typeof AGENTS[number];

export function parseAgent(value: unknown): Agent | null {
  return typeof value === "string" && (AGENTS as readonly string[]).includes(value)
    ? value as Agent
    : null;
}

export function serviceClientConfig() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("missing_supabase_env");
  return { url, key };
}
