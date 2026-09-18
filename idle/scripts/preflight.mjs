// IDLE — can a person actually sign up?
//
//   node scripts/preflight.mjs
//   node scripts/preflight.mjs --email you@example.com   (really sends one)
//
// Answers it by asking the hosted project, in the order a new person meets each
// step, and stops being polite about which one is broken. Run it from a machine
// that can reach the project — not from CI, and not from a sandbox.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");

function env() {
  const file = join(HERE, "apps", "mobile", ".env");
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) out[match[1]] = match[2].trim();
    }
  } catch {
    // Fall through to the process environment.
  }
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? out.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? out.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

const { url, key } = env();
const emailFlag = process.argv.indexOf("--email");
const testEmail = emailFlag > -1 ? process.argv[emailFlag + 1] : null;

const results = [];
const check = (label, ok, detail, fix) => results.push({ label, ok, detail, fix });

const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };

async function ask(path, init = {}) {
  const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  return { status: response.status, body: await response.text() };
}

// ---------------------------------------------------------------------------

if (!url || !key) {
  console.error("No project configured. Copy apps/mobile/.env.example to .env first.");
  process.exit(1);
}

console.log(`\n  IDLE — preflight against ${url}\n`);

// 1. Is the project there at all?
//
// This one is a gate, not a check. Every question below reads a status code, and
// a proxy that denies the connection also returns a status code — so running
// them against a blocked host produces confident, wrong answers. An earlier
// version of this script did exactly that: it reported "the schema is applied"
// while nothing had reached the server at all.
let reachable = false;
try {
  const { status } = await ask("/auth/v1/health");
  reachable = status === 200;
  check(
    "The project answers",
    reachable,
    `auth/v1/health → ${status}`,
    status === 403
      ? "403 on every request usually means a proxy or firewall in front of you, not the project"
      : "Check the URL in apps/mobile/.env",
  );
} catch (error) {
  check("The project answers", false, error.message, "Check the URL, and whether something is blocking outbound HTTPS");
}

if (!reachable) {
  console.log(`  × ${results[0].label.padEnd(34)} ${results[0].detail}`);
  console.log();
  console.log("  Stopping here. Nothing else can be answered honestly from a machine");
  console.log("  that cannot reach the project — every check below reads a status code,");
  console.log("  and a blocked connection has one too.");
  console.log();
  if (results[0].fix) console.log(`  ${results[0].fix}`);
  console.log();
  process.exit(1);
}

// 2. Has the schema been applied? Without this nobody can finish signing up.
try {
  const { status } = await ask("/rest/v1/profiles?select=id&limit=1");
  // 200 or 401/403 both mean the table is there; 404 means it is not.
  // 200 means it is there; 401 means it is there and RLS is doing its job.
  // 404 means it is not. Anything else is not an answer about the schema.
  check(
    "The schema is applied",
    status === 200 || status === 401,
    `rest/v1/profiles → ${status}`,
    "Run ./scripts/setup.sh — the migrations have never been pushed",
  );
} catch (error) {
  check("The schema is applied", false, error.message);
}

// 3. Do the functions a new account needs actually exist?
for (const [rpc, label] of [
  ["claim_handle", "Choosing a handle works"],
  ["create_pairing_code", "Pairing a terminal works"],
  ["friends_with_presence", "The list works"],
  ["export_my_data", "Data export works"],
]) {
  try {
    // No session, so 401 is the healthy answer; 404 means the function is absent.
    // No session, so 401 is healthy, and 400 means it exists and dislikes the
    // empty arguments. 404 means it was never created.
    const { status } = await ask(`/rest/v1/rpc/${rpc}`, { method: "POST", body: "{}" });
    check(label, [200, 400, 401].includes(status), `rpc/${rpc} → ${status}`, "Run ./scripts/setup.sh");
  } catch (error) {
    check(label, false, error.message);
  }
}

// 4. Are the edge functions deployed?
for (const fn of ["pair", "heartbeat", "notify"]) {
  try {
    const response = await fetch(`${url}/functions/v1/${fn}`, { method: "POST", headers, body: "{}" });
    check(
      `The ${fn} endpoint is deployed`,
      [200, 400, 401, 405].includes(response.status),
      `functions/v1/${fn} → ${response.status}`,
      `supabase functions deploy ${fn} --no-verify-jwt`,
    );
  } catch (error) {
    check(`The ${fn} endpoint is deployed`, false, error.message);
  }
}

// 5. What can auth actually do?
try {
  const { status, body } = await ask("/auth/v1/settings");
  const settings = status === 200 ? JSON.parse(body) : {};
  const providers = Object.entries(settings.external ?? {})
    .filter(([, on]) => on)
    .map(([name]) => name);
  check(
    "Email sign-in is enabled",
    settings.external?.email !== false,
    providers.length ? `providers: ${providers.join(", ")}` : "none reported",
  );
  check(
    "Sign in with Apple is enabled",
    settings.external?.apple === true,
    settings.external?.apple ? "yes" : "not yet — iOS needs it once any other provider is offered",
    "Authentication → Providers → Apple",
  );
} catch (error) {
  check("Email sign-in is enabled", false, error.message);
}

// 6. The one that cannot be inferred: does a magic link actually leave?
if (testEmail) {
  try {
    const { status, body } = await ask("/auth/v1/otp", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, create_user: true }),
    });
    const ok = status === 200;
    check(
      "A magic link really sends",
      ok,
      ok ? `sent to ${testEmail} — go and look` : `${status} ${body.slice(0, 120)}`,
      "Authentication → Emails → SMTP. The built-in sender is capped and fails silently",
    );
  } catch (error) {
    check("A magic link really sends", false, error.message);
  }
} else {
  console.log("  (pass --email you@example.com to test that a magic link really sends)\n");
}

// ---------------------------------------------------------------------------

for (const r of results) {
  console.log(`  ${r.ok ? "·" : "×"} ${r.label.padEnd(34)} ${r.detail}`);
}

const failed = results.filter((r) => !r.ok);
console.log();
if (failed.length === 0) {
  console.log("  Everything checkable from here is ready.");
  if (!testEmail) {
    console.log("  The last unknown is email delivery — re-run with --email to settle it.\n");
  } else {
    console.log("  A person can sign up.\n");
  }
} else {
  console.log(`  ${failed.length} thing${failed.length === 1 ? "" : "s"} to fix. Start here:\n`);
  console.log(`    ${failed[0].label}`);
  if (failed[0].fix) console.log(`    ${failed[0].fix}`);
  console.log();
}

process.exit(failed.length === 0 ? 0 : 1);
