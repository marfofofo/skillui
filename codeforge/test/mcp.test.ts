import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { closeMcp, connectMcpServers } from "../src/mcp.js";

const server = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "mcp-server.ts");

test("MCP stdio tools are wrapped and callable", async () => {
  const conns = await connectMcpServers({ demo: { command: process.execPath, args: ["--import", "tsx", server] } }, process.cwd());
  try {
    assert.equal(conns[0].error, undefined);
    const add = conns[0].tools.find((t) => t.name === "mcp__demo__add")!;
    assert.equal(add.readOnly, true);
    const out = await add.run({ a: 2, b: 3 }, { cwd: process.cwd(), signal: new AbortController().signal, readFiles: new Map(), todos: [] });
    assert.equal(out, "5");
  } finally {
    await closeMcp(conns);
  }
});
