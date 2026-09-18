// The test that guards docs/PRESENCE_PROTOCOL.md §2.
// If this fails, the privacy promise is broken.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { buildPayload, redactedRead, shouldSend } from "../src/hook.js";
import { THROTTLE_MS } from "../src/constants.js";

// A realistic Claude Code hook payload: everything we must never transmit.
const HOOK_STDIN = JSON.stringify({
  session_id: "abc123",
  hook_event_name: "PreToolUse",
  cwd: "/Users/marcus/work/secret-startup",
  transcript_path: "/Users/marcus/.claude/transcripts/abc123.jsonl",
  permission_mode: "acceptEdits",
  tool_name: "Bash",
  tool_input: { command: "psql -c 'select * from customers'" },
  last_assistant_message: "I have updated the billing schema.",
});

test("the wire format is exactly four fields", () => {
  const payload = buildPayload("session_start", "claude_code");
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["agent", "client", "event", "nonce"],
  );
});

test("the payload carries nothing from stdin, the cwd or the environment", () => {
  const serialised = JSON.stringify(buildPayload("heartbeat", "claude_code"));

  for (const secret of [
    "secret-startup",
    "transcripts",
    "psql",
    "customers",
    "billing",
    "acceptEdits",
    "abc123",
    process.cwd(),
  ]) {
    assert.equal(
      serialised.includes(secret),
      false,
      `payload leaked ${JSON.stringify(secret)}`,
    );
  }
});

test("redactedRead returns a byte count and never the bytes", async () => {
  const result = await redactedRead(Readable.from([HOOK_STDIN]));
  assert.equal(typeof result, "number");
  assert.equal(result, Buffer.byteLength(HOOK_STDIN));
});

test("redactedRead resolves on a stream that never ends", async () => {
  const stalled = new Readable({ read() {} });
  stalled.push("{\"cwd\":\"/private\"");
  const result = await redactedRead(stalled);
  assert.equal(typeof result, "number");
  stalled.destroy();
});

test("only the agent name reaches the payload, and only from our own list", () => {
  assert.equal(buildPayload("heartbeat", "codex").agent, "codex");
  assert.equal(buildPayload("heartbeat", null).agent, null);
});

test("nonces do not repeat", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(buildPayload("heartbeat", "codex").nonce);
  assert.equal(seen.size, 500);
});

test("session boundaries bypass the throttle, mid-session beats do not", () => {
  const justSent = { last_sent_at: Date.now() };
  assert.equal(shouldSend("session_start", justSent), true);
  assert.equal(shouldSend("session_end", justSent), true);
  assert.equal(shouldSend("heartbeat", justSent), false);
  assert.equal(
    shouldSend("heartbeat", { last_sent_at: Date.now() - THROTTLE_MS - 1 }),
    true,
  );
  assert.equal(shouldSend("heartbeat", {}), true);
});
