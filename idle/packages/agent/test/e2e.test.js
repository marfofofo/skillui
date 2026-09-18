// "IDLE" — the whole CLI, against a real HTTP server, on a real filesystem.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/idle.js", import.meta.url));

let server;
let baseUrl;
let home;
let claudeDir;
const received = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      received.push({
        path: req.url,
        auth: req.headers.authorization ?? null,
        body: body ? JSON.parse(body) : null,
      });
      res.setHeader("content-type", "application/json");
      if (req.url === "/pair") {
        res.end(JSON.stringify({
          token: "t".repeat(43),
          device_id: "00000000-0000-4000-8000-000000000000",
          handle: "marcus",
        }));
      } else {
        res.end(JSON.stringify({ ok: true }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  home = mkdtempSync(join(tmpdir(), "idle-home-"));
  claudeDir = mkdtempSync(join(tmpdir(), "idle-claude-"));
});

after(() => {
  server?.close();
  rmSync(home, { recursive: true, force: true });
  rmSync(claudeDir, { recursive: true, force: true });
});

// execFileSync would block this process's event loop, and the test server lives
// in it — the child would wait forever for a reply that cannot be written.
async function run(args, extraEnv = {}) {
  try {
    const { stdout } = await exec(process.execPath, [BIN, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        IDLE_API_URL: baseUrl,
        IDLE_HOME: home,
        CLAUDE_CONFIG_DIR: claudeDir,
        CODEX_HOME: join(claudeDir, "no-codex-here"),
        ...extraEnv,
      },
    });
    return stdout;
  } catch (error) {
    // `status` exits 1 when nothing is linked; that is an answer, not a crash.
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

const settings = () => JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf8"));

test("status before linking says so", async () => {
  const output = await run(["status"]);
  assert.match(output, /TERMINAL NOT LINKED/);
});

test("link redeems the code, stores the token 0600, and writes the hooks", async () => {
  const output = await run(["link", "k4m-7qx", "--label", "test-machine"]);

  const pairRequest = received.find((r) => r.path === "/pair");
  assert.equal(pairRequest.body.code, "K4M7QX", "code is normalised and upper-cased");
  assert.equal(pairRequest.body.label, "test-machine");

  const credentialsPath = join(home, "credentials.json");
  assert.equal(existsSync(credentialsPath), true);
  assert.equal(JSON.parse(readFileSync(credentialsPath, "utf8")).handle, "marcus");

  assert.deepEqual(Object.keys(settings().hooks).sort(), [
    "PreToolUse", "SessionEnd", "SessionStart", "Stop", "UserPromptSubmit",
  ]);

  assert.match(output, /MARCUS/);
  assert.match(output, /CLAUDE CODE/);
});

test("codex is left alone when it is not installed", async () => {
  assert.equal(existsSync(join(claudeDir, "no-codex-here", "hooks.json")), false);
});

test("a hook sends exactly the four documented fields, with the token", async () => {
  received.length = 0;
  await run(["hook", "session-start", "--agent", "claude_code"]);

  const beat = received.find((r) => r.path === "/heartbeat");
  assert.ok(beat, "a heartbeat was sent");
  assert.equal(beat.auth, `Bearer ${"t".repeat(43)}`);
  assert.deepEqual(Object.keys(beat.body).sort(), ["agent", "client", "event", "nonce"]);
  assert.equal(beat.body.event, "session_start");
  assert.equal(beat.body.agent, "claude_code");
});

test("a hook fed a full Claude Code payload on stdin transmits none of it", async () => {
  received.length = 0;
  const stdin = JSON.stringify({
    cwd: "/Users/marcus/work/secret-startup",
    tool_input: { command: "cat .env" },
    last_assistant_message: "Done.",
  });

  const child = exec(process.execPath, [BIN, "hook", "session-end", "--agent", "claude_code"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", IDLE_API_URL: baseUrl, IDLE_HOME: home },
  });
  child.child.stdin.end(stdin);
  await child;

  const beat = received.find((r) => r.path === "/heartbeat");
  const wire = JSON.stringify(beat.body);
  for (const secret of ["secret-startup", ".env", "Done.", "cwd", "tool_input"]) {
    assert.equal(wire.includes(secret), false, `leaked ${secret}`);
  }
});

test("mid-session beats are throttled but session boundaries are not", async () => {
  received.length = 0;
  await run(["hook", "heartbeat", "--agent", "claude_code"]);
  await run(["hook", "heartbeat", "--agent", "claude_code"]);
  await run(["hook", "heartbeat", "--agent", "claude_code"]);
  assert.equal(received.filter((r) => r.path === "/heartbeat").length, 0,
    "a session-end was just sent, so these are inside the throttle window");

  await run(["hook", "session-start", "--agent", "claude_code"]);
  assert.equal(received.filter((r) => r.path === "/heartbeat").length, 1);
});

test("status reports the linked account and the installed hooks", async () => {
  const output = await run(["status"]);
  assert.match(output, /MARCUS/);
  assert.match(output, /5 installed/);
});

test("a hook never fails, even with no server and no credentials", async () => {
  const { stdout } = await exec(
    process.execPath,
    [BIN, "hook", "heartbeat", "--agent", "codex"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        IDLE_API_URL: "http://127.0.0.1:1",
        IDLE_HOME: mkdtempSync(join(tmpdir(), "idle-empty-")),
      },
    },
  );
  assert.equal(stdout, "");
});

test("unlink removes the hooks and forgets the token", async () => {
  await run(["unlink"]);
  assert.equal(existsSync(join(home, "credentials.json")), false);
  assert.equal(settings().hooks, undefined);
});

test("a hook whose stdin is never closed still exits", async () => {
  // Regression: a resumed stdin keeps Node's event loop alive. If this ever
  // regresses, every coding session leaves a zombie process behind per tool call.
  const child = exec(process.execPath, [BIN, "hook", "heartbeat", "--agent", "claude_code"], {
    encoding: "utf8",
    timeout: 8_000,
    env: { ...process.env, NO_COLOR: "1", IDLE_API_URL: baseUrl, IDLE_HOME: home },
  });

  child.child.stdin.write('{"cwd":"/never/closed"');  // no end(), no newline

  const started = Date.now();
  await child;
  const elapsed = Date.now() - started;

  assert.ok(elapsed < 5_000, `hook took ${elapsed}ms to exit`);
});
