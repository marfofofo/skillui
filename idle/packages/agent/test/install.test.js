// "IDLE" — we are a guest in someone else's settings file.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeIdleHooks,
  stripIdleHooks,
  countIdleHooks,
  resolveCommand,
  CLAUDE_EVENTS,
  IDLE_COMMAND_RE,
} from "../src/install.js";

const OPTIONS = { execPath: "/usr/bin/node", scriptPath: "/opt/idle/bin/idle.js" };

// A settings file with real user configuration in it, including hooks of
// their own on the same events we want.
const USER_SETTINGS = Object.freeze({
  model: "opus",
  permissions: { allow: ["Bash(npm test)"] },
  hooks: {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [{ type: "command", command: "/home/me/.claude/guard.sh" }],
      },
    ],
    SessionStart: [
      { hooks: [{ type: "command", command: "echo hello" }] },
    ],
  },
});

test("merging keeps every setting the user already had", () => {
  const merged = mergeIdleHooks(USER_SETTINGS, CLAUDE_EVENTS, "claude_code", OPTIONS);

  assert.equal(merged.model, "opus");
  assert.deepEqual(merged.permissions, { allow: ["Bash(npm test)"] });
  assert.equal(
    merged.hooks.PreToolUse.some((g) =>
      g.hooks.some((h) => h.command === "/home/me/.claude/guard.sh"),
    ),
    true,
  );
  assert.equal(
    merged.hooks.SessionStart.some((g) =>
      g.hooks.some((h) => h.command === "echo hello"),
    ),
    true,
  );
});

test("merging does not mutate the object it was given", () => {
  const before = JSON.stringify(USER_SETTINGS);
  mergeIdleHooks(USER_SETTINGS, CLAUDE_EVENTS, "claude_code", OPTIONS);
  assert.equal(JSON.stringify(USER_SETTINGS), before);
});

test("one entry lands on each of the five lifecycle events", () => {
  const merged = mergeIdleHooks({}, CLAUDE_EVENTS, "claude_code", OPTIONS);
  assert.deepEqual(Object.keys(merged.hooks).sort(), Object.keys(CLAUDE_EVENTS).sort());
  assert.equal(countIdleHooks(merged), 5);
});

test("linking twice leaves exactly one set of entries", () => {
  let settings = mergeIdleHooks(USER_SETTINGS, CLAUDE_EVENTS, "claude_code", OPTIONS);
  settings = mergeIdleHooks(settings, CLAUDE_EVENTS, "claude_code", OPTIONS);
  settings = mergeIdleHooks(settings, CLAUDE_EVENTS, "claude_code", OPTIONS);
  assert.equal(countIdleHooks(settings), 5);
});

test("a user's catch-all group gains one entry rather than a parallel group", () => {
  const merged = mergeIdleHooks(USER_SETTINGS, CLAUDE_EVENTS, "claude_code", OPTIONS);
  assert.equal(merged.hooks.SessionStart.length, 1);
  assert.equal(merged.hooks.SessionStart[0].hooks.length, 2);
});

test("a user's matched group is left alone", () => {
  const merged = mergeIdleHooks(USER_SETTINGS, CLAUDE_EVENTS, "claude_code", OPTIONS);
  const guard = merged.hooks.PreToolUse.find((g) => g.matcher === "Bash");
  assert.deepEqual(guard.hooks, [
    { type: "command", command: "/home/me/.claude/guard.sh" },
  ]);
});

test("unlinking restores the file exactly", () => {
  const merged = mergeIdleHooks(USER_SETTINGS, CLAUDE_EVENTS, "claude_code", OPTIONS);
  const stripped = stripIdleHooks(merged);
  assert.deepEqual(stripped, USER_SETTINGS);
});

test("unlinking a file we never touched changes nothing", () => {
  assert.deepEqual(stripIdleHooks(USER_SETTINGS), USER_SETTINGS);
  assert.deepEqual(stripIdleHooks({}), {});
  assert.deepEqual(stripIdleHooks(null), {});
});

test("our entries are async and bounded so a hook cannot stall a session", () => {
  const merged = mergeIdleHooks({}, CLAUDE_EVENTS, "claude_code", OPTIONS);
  for (const groups of Object.values(merged.hooks)) {
    for (const hook of groups[0].hooks) {
      assert.equal(hook.async, true);
      assert.equal(hook.timeout, 5);
      assert.equal(hook.type, "command");
    }
  }
});

test("paths with spaces are quoted", () => {
  const command = resolveCommand("heartbeat", "claude_code", {
    execPath: "/usr/bin/node",
    scriptPath: "/Users/me/Application Support/idle/bin/idle.js",
  });
  assert.match(command, /"\/Users\/me\/Application Support\/idle\/bin\/idle\.js"/);
  assert.match(command, IDLE_COMMAND_RE);
});

test("the marker matches our commands and not similarly named ones", () => {
  assert.match(resolveCommand("session-start", "codex", OPTIONS), IDLE_COMMAND_RE);
  assert.doesNotMatch("/usr/bin/idle-monitor --watch", IDLE_COMMAND_RE);
  assert.doesNotMatch("node hooks/heartbeat.js", IDLE_COMMAND_RE);
  assert.doesNotMatch("echo 'idle hook is a nice idea'", IDLE_COMMAND_RE);
});
