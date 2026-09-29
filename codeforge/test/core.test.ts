import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Agent, type StreamFn, type StreamParams } from "../src/agent.js";
import { Hooks } from "../src/hooks.js";
import { Permissions, splitShell } from "../src/permissions.js";
import { builtinTools } from "../src/tools/index.js";
import type { ToolContext } from "../src/tools/types.js";
import { SilentRenderer } from "../src/ui.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "codeforge-"));
const tool = (name: string) => builtinTools().find((t) => t.name === name)!;
const ctx = (cwd: string): ToolContext => ({ cwd, signal: new AbortController().signal, readFiles: new Map(), todos: [] });

test("Edit requires a prior Read and a unique match", async () => {
  const dir = tmp();
  const file = path.join(dir, "a.txt");
  fs.writeFileSync(file, "foo\nbar\nfoo\n");
  const c = ctx(dir);
  await assert.rejects(tool("Edit").run({ file_path: "a.txt", old_string: "bar", new_string: "baz" }, c), /has not been read/);
  await tool("Read").run({ file_path: "a.txt" }, c);
  await assert.rejects(tool("Edit").run({ file_path: "a.txt", old_string: "foo", new_string: "x" }, c), /appears 2 times/);
  await tool("Edit").run({ file_path: "a.txt", old_string: "bar", new_string: "$& baz" }, c);
  assert.equal(fs.readFileSync(file, "utf8"), "foo\n$& baz\nfoo\n");
  await tool("Edit").run({ file_path: "a.txt", old_string: "foo", new_string: "x", replace_all: true }, c);
  assert.equal(fs.readFileSync(file, "utf8"), "x\n$& baz\nx\n");
});

test("Read numbers lines and paginates", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "b.txt"), "one\ntwo\nthree");
  const out = await tool("Read").run({ file_path: "b.txt", offset: 2, limit: 1 }, ctx(dir));
  assert.match(out, /^\s+2\ttwo/);
  assert.match(out, /offset=3/);
});

test("Bash returns output and exit code", async () => {
  const out = await tool("Bash").run({ command: "echo hi; exit 3" }, ctx(tmp()));
  assert.match(out, /hi/);
  assert.match(out, /exit code 3/);
});

test("Grep and Glob find files", async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "x.ts"), "const needle = 1;\n");
  assert.match(await tool("Grep").run({ pattern: "needle" }, ctx(dir)), /src\/x\.ts/);
  assert.match(await tool("Glob").run({ pattern: "**/*.ts" }, ctx(dir)), /x\.ts$/);
});

test("permission rules cannot be bypassed with command chaining", async () => {
  assert.deepEqual(splitShell("npm test && rm -rf /"), ["npm test", "rm -rf /"]);
  assert.equal(splitShell("echo $(whoami)"), undefined);
  const p = new Permissions("default", ["Bash(npm test:*)"], ["Bash(git push:*)"], "/repo", undefined);
  const bash = tool("Bash");
  assert.equal((await p.check(bash, { command: "npm test -- --watch=false" })).allow, true);
  assert.equal((await p.check(bash, { command: "npm test && rm -rf /" })).allow, false);
  assert.equal((await p.check(bash, { command: "npm testing" })).allow, false);
  const deny = await p.check(bash, { command: "echo ok; git push origin main" });
  assert.equal(deny.allow, false);
  assert.equal((await p.check(tool("Read"), { file_path: "/etc/passwd" })).allow, true);
});

test("modes: plan blocks writes, acceptEdits allows edits inside cwd only", async () => {
  const plan = new Permissions("plan", [], [], "/repo", async () => "yes");
  assert.equal((await plan.check(tool("Write"), { file_path: "a", content: "" })).allow, false);
  const accept = new Permissions("acceptEdits", [], [], "/repo", async () => "no");
  assert.equal((await accept.check(tool("Edit"), { file_path: "src/a.ts" })).allow, true);
  assert.equal((await accept.check(tool("Edit"), { file_path: "/etc/hosts" })).allow, false);
  assert.equal((await accept.check(tool("Bash"), { command: "ls" })).allow, false);
});

test("'always' adds a session rule", async () => {
  let asked = 0;
  const p = new Permissions("default", [], [], "/repo", async () => (asked++, "always"));
  await p.check(tool("Bash"), { command: "npm run build" });
  await p.check(tool("Bash"), { command: "npm run lint" });
  assert.equal(asked, 1);
});

/** A scripted stand-in for client.beta.messages.stream. */
function fakeStream(script: Array<(params: StreamParams) => any>): { fn: StreamFn; calls: StreamParams[] } {
  const calls: StreamParams[] = [];
  const fn: StreamFn = (params) => {
    calls.push(structuredClone(params));
    const message = script[calls.length - 1](params);
    const listeners: Array<(e: any) => void> = [];
    return {
      on: (_e: "streamEvent", l: (e: any) => void) => listeners.push(l),
      async finalMessage() {
        for (const b of message.content) if (b.type === "text") listeners.forEach((l) => l({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: b.text } }));
        return message;
      },
    };
  };
  return { fn, calls };
}

const msg = (content: any[], stop_reason: string) => ({
  id: "m",
  type: "message",
  role: "assistant",
  model: "test",
  content,
  stop_reason,
  stop_details: null,
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
});

function makeAgent(stream: StreamFn, cwd: string, mode: "default" | "bypassPermissions" = "bypassPermissions", hooks?: Hooks) {
  return new Agent({
    stream,
    model: "test",
    effort: "high",
    maxTokens: 1000,
    system: "sys",
    tools: builtinTools(),
    permissions: new Permissions(mode, [], [], cwd, undefined),
    hooks,
    renderer: new SilentRenderer(),
    fallbacks: true,
    webSearch: false,
    autoCompactTokens: 1e9,
    context: { cwd, readFiles: new Map(), todos: [] },
  });
}

test("agent loop runs tools, returns results in one message, and stops at end_turn", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "f.txt"), "hello");
  const { fn, calls } = fakeStream([
    () =>
      msg(
        [
          { type: "tool_use", id: "t1", name: "Read", input: { file_path: "f.txt" } },
          { type: "tool_use", id: "t2", name: "Glob", input: { pattern: "*.txt" } },
        ],
        "tool_use",
      ),
    () => msg([{ type: "text", text: "done" }], "end_turn"),
  ]);
  const agent = makeAgent(fn, dir);
  const out = await agent.send("read it", new AbortController().signal);
  assert.equal(out, "done");
  assert.equal(calls.length, 2);
  const second = calls[1];
  assert.equal(second.fallbacks, "default");
  assert.deepEqual(second.cache_control, { type: "ephemeral" });
  const results = second.messages.at(-1)!.content as any[];
  assert.equal(results.length, 2);
  assert.match(results[0].content, /hello/);
  assert.equal(agent.messages.length, 4);
});

test("invalid tool input and denied permissions come back as error results", async () => {
  const dir = tmp();
  const { fn, calls } = fakeStream([
    () =>
      msg(
        [
          { type: "tool_use", id: "t1", name: "Read", input: { wrong: 1 } },
          { type: "tool_use", id: "t2", name: "Bash", input: { command: "touch x" } },
        ],
        "tool_use",
      ),
    () => msg([{ type: "text", text: "ok" }], "end_turn"),
  ]);
  await makeAgent(fn, dir, "default").send("go", new AbortController().signal);
  const results = calls[1].messages.at(-1)!.content as any[];
  assert.equal(results[0].is_error, true);
  assert.match(results[0].content, /Invalid input/);
  assert.equal(results[1].is_error, true);
  assert.equal(fs.existsSync(path.join(dir, "x")), false);
});

test("truncated tool calls are not executed", async () => {
  const dir = tmp();
  const { fn } = fakeStream([() => msg([{ type: "tool_use", id: "t1", name: "Bash", input: { command: "touch y" } }], "max_tokens")]);
  await makeAgent(fn, dir).send("go", new AbortController().signal);
  assert.equal(fs.existsSync(path.join(dir, "y")), false);
});

test("PreToolUse hook exit 2 blocks the tool", async () => {
  const dir = tmp();
  const hooks = new Hooks({ PreToolUse: [{ matcher: "Bash", command: "echo 'no shell today' >&2; exit 2" }] }, dir);
  const { fn, calls } = fakeStream([
    () => msg([{ type: "tool_use", id: "t1", name: "Bash", input: { command: "touch z" } }], "tool_use"),
    () => msg([{ type: "text", text: "ok" }], "end_turn"),
  ]);
  await makeAgent(fn, dir, "bypassPermissions", hooks).send("go", new AbortController().signal);
  const result = (calls[1].messages.at(-1)!.content as any[])[0];
  assert.match(result.content, /no shell today/);
  assert.equal(fs.existsSync(path.join(dir, "z")), false);
});

test("compact replaces history with a summary", async () => {
  const { fn } = fakeStream([
    () => msg([{ type: "text", text: "hi" }], "end_turn"),
    () => msg([{ type: "text", text: "SUMMARY" }], "end_turn"),
  ]);
  const agent = makeAgent(fn, tmp());
  await agent.send("hello", new AbortController().signal);
  await agent.compact(new AbortController().signal);
  assert.equal(agent.messages.length, 1);
  assert.match((agent.messages[0].content as any[])[0].text, /SUMMARY/);
});
