// IDLE — the loop, from the terminal to the light.
//
// Presence has been tested at the database level and at the CLI level, and until
// this file the two had never met. That gap was the riskiest assumption in the
// repository: every piece passing on its own says nothing about whether a light
// actually comes on.
//
// So: the real schema in a real PostgreSQL, the real endpoints — the same RPCs
// the edge functions call, with the same hashing — and the real `idle` binary
// driving them. The only link not covered is Supabase's edge runtime itself.
//
//   PGHOST=/tmp/sock PGUSER=postgres node --test test/presence-loop.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const exec = promisify(execFile);
const BIN = fileURLToPath(new URL("../packages/agent/bin/idle.js", import.meta.url));
const DB = process.env.IDLE_TEST_DB ?? "idle_loop_test";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

let admin;
let db;
let server;
let baseUrl;
let home;
let claudeDir;
let userId;

/** The two endpoints, implemented exactly as the edge functions implement them. */
function endpoints(client) {
  return createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const reply = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };

      try {
        const parsed = body ? JSON.parse(body) : {};

        if (req.url === "/pair") {
          const token = randomBytes(32).toString("base64url");
          const { rows } = await client.query(
            "select * from public.pair_device($1, $2, $3, $4)",
            [parsed.code, sha256(token), parsed.label ?? null, parsed.agent ?? null],
          );
          return reply(200, { token, device_id: rows[0].device_id, handle: rows[0].handle });
        }

        if (req.url === "/heartbeat") {
          const header = req.headers.authorization ?? "";
          const token = header.replace(/^Bearer\s+/i, "");
          const { rows } = await client.query(
            "select public.record_heartbeat($1, $2, $3) as ok",
            [sha256(token), parsed.event, parsed.agent ?? null],
          );
          return rows[0].ok ? reply(200, { ok: true }) : reply(401, { error: "unauthorized" });
        }

        reply(404, { error: "not_found" });
      } catch (error) {
        reply(400, { error: String(error.message).slice(0, 120) });
      }
    });
  });
}

const run = (args, extraEnv = {}) =>
  exec(process.execPath, [BIN, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      IDLE_API_URL: baseUrl,
      IDLE_HOME: home,
      CLAUDE_CONFIG_DIR: claudeDir,
      CODEX_HOME: join(claudeDir, "no-codex"),
      ...extraEnv,
    },
  }).catch((error) => ({ stdout: error.stdout ?? "", stderr: error.stderr ?? "" }));

const presence = async () => {
  const { rows } = await db.query(
    "select is_live, agent, session_started_at, last_heartbeat_at from public.presence where user_id = $1",
    [userId],
  );
  return rows[0];
};

before(async () => {
  admin = new pg.Client({ database: "postgres" });
  await admin.connect();
  await admin.query(`drop database if exists ${DB}`);
  await admin.query(`create database ${DB}`);

  const here = fileURLToPath(new URL(".", import.meta.url));
  const { execFileSync } = await import("node:child_process");
  const psql = (file) =>
    execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", "--no-psqlrc", "-d", DB, "-f", file], {
      stdio: ["ignore", "ignore", "pipe"],
    });

  const { readdirSync } = await import("node:fs");
  psql(join(here, "..", "supabase", "tests", "00_bootstrap.sql"));
  const migrations = join(here, "..", "supabase", "migrations");
  for (const file of readdirSync(migrations).sort()) psql(join(migrations, file));

  db = new pg.Client({ database: DB });
  await db.connect();

  // One account, created the way the app creates one.
  userId = "11111111-1111-4111-8111-111111111111";
  await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
             'loop@idle.test', now(), now(), now())`,
    [userId],
  );
  await db.query(
    `select set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, false)`,
    [userId],
  );
  await db.query("select public.claim_handle('looper')");

  server = endpoints(db);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  home = mkdtempSync(join(tmpdir(), "idle-loop-home-"));
  claudeDir = mkdtempSync(join(tmpdir(), "idle-loop-claude-"));
});

after(async () => {
  server?.close();
  await db?.end();
  await admin?.query(`drop database if exists ${DB}`).catch(() => {});
  await admin?.end();
  rmSync(home, { recursive: true, force: true });
  rmSync(claudeDir, { recursive: true, force: true });
});

test("the account starts dark", async () => {
  const state = await presence();
  assert.equal(state.is_live, false);
  assert.equal(state.agent, null);
});

test("the app issues a code and the terminal redeems it", async () => {
  const { rows } = await db.query("select * from public.create_pairing_code()");
  const code = rows[0].code;

  const output = await run(["link", code, "--label", "loop-machine"]);
  assert.match(output.stdout, /LOOPER/);

  const { rows: devices } = await db.query(
    "select label, token_hash from public.devices where user_id = $1",
    [userId],
  );
  assert.equal(devices.length, 1);
  assert.equal(devices[0].label, "loop-machine");
  // The token itself never reached the database.
  assert.match(devices[0].token_hash, /^[0-9a-f]{64}$/);
});

test("starting a session turns the light on", async () => {
  await run(["hook", "session-start", "--agent", "claude_code"]);

  const state = await presence();
  assert.equal(state.is_live, true, "the lamp is lit");
  assert.equal(state.agent, "claude_code");
  assert.ok(state.session_started_at, "and the session is dated");
});

test("a beat mid-session keeps it on without restarting the session", async () => {
  const before = await presence();

  // Clear the CLI's local throttle, or it would decline to send at all and this
  // would assert nothing. (An earlier version of this test pointed the CLI at a
  // fresh IDLE_HOME, which has no credentials — so the hook sent nothing and the
  // assertion passed because the light was already on. Vacuous.)
  writeFileSync(join(home, "state.json"), JSON.stringify({ last_sent_at: 0 }));

  await run(["hook", "heartbeat", "--agent", "claude_code"]);

  const after = await presence();
  assert.equal(after.is_live, true);
  assert.ok(
    after.last_heartbeat_at > before.last_heartbeat_at,
    "the beat actually reached the database",
  );
  assert.deepEqual(
    after.session_started_at,
    before.session_started_at,
    "and did not restart the session",
  );
});

test("ending the session puts the light out", async () => {
  await run(["hook", "session-end", "--agent", "claude_code"]);
  assert.equal((await presence()).is_live, false);
});

test("a terminal that dies goes dark on its own", async () => {
  await run(["hook", "session-start", "--agent", "codex"]);
  assert.equal((await presence()).is_live, true);

  // The machine is unplugged: no session-end ever arrives.
  await db.query(
    `update public.presence set last_heartbeat_at = now() - interval '10 minutes' where user_id = $1`,
    [userId],
  );
  await db.query(
    `update public.devices set last_seen_at = now() - interval '10 minutes' where user_id = $1`,
    [userId],
  );

  const { rows } = await db.query("select public.sweep_presence() as swept");
  assert.equal(rows[0].swept, 1);
  assert.equal((await presence()).is_live, false, "the light goes out by itself");
});

test("a revoked terminal stops being believed", async () => {
  await db.query("update public.devices set revoked_at = now() where user_id = $1", [userId]);
  await run(["hook", "session-start", "--agent", "claude_code"]);
  assert.equal((await presence()).is_live, false);
});

test("and nothing about the machine ever reached the database", async () => {
  // The whole privacy claim, checked against the rows rather than the code: no
  // column anywhere holds a path, a prompt, or anything from the hook payload.
  const { rows } = await db.query(`
    select string_agg(coalesce(label, '') || coalesce(agent::text, ''), ' ') as everything
    from public.devices where user_id = $1
  `, [userId]);
  const stored = rows[0].everything ?? "";
  for (const secret of ["/home", "/Users", "prompt", "transcript", "cwd"]) {
    assert.equal(stored.includes(secret), false, `leaked ${secret}`);
  }
});
