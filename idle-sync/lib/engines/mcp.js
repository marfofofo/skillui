// Server MCP interno: espone gli strumenti del Mac a Claude Code.
// Ascolta solo su 127.0.0.1 con una porta casuale e un segreto generato a ogni avvio,
// e gira nello stesso processo di IDLE SYNC, così le conferme arrivano subito ai dispositivi.

import { randomBytes, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config.js";
import { executeTool, toolDefinitions } from "../tools.js";
import { readJson, sendJson } from "../web.js";

export const MCP_NAME = "idle";

// Dal formato dei blocchi dell'API a quello dei contenuti MCP.
function toMcpContent(content) {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map((block) =>
    block.type === "image"
      ? { type: "image", data: block.source.data, mimeType: block.source.media_type }
      : { type: "text", text: block.text },
  );
}

// getContext() restituisce { io, autoApprove, signal } del comando in corso, oppure null.
export async function startMcpServer(getContext) {
  const secret = randomBytes(24).toString("base64url");
  const expected = Buffer.from(`Bearer ${secret}`);

  function authorized(req) {
    const got = Buffer.from(String(req.headers.authorization ?? ""));
    return got.length === expected.length && timingSafeEqual(got, expected);
  }

  function createServer() {
    const server = new Server({ name: "idle-sync", version: config.version }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolDefinitions.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const context = getContext();
      if (!context) return { isError: true, content: [{ type: "text", text: "Nessun comando in corso." }] };
      const { name, arguments: args } = request.params;
      const result = await executeTool(name, args, context);
      return { isError: result.isError, content: toMcpContent(result.content) };
    });

    return server;
  }

  const httpServer = http.createServer(async (req, res) => {
    if (new URL(req.url, "http://x").pathname !== "/mcp") return sendJson(res, 404, { error: "Non trovato" });
    if (!authorized(req)) return sendJson(res, 401, { error: "Non autorizzato" });
    if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo non consentito" });

    try {
      const body = await readJson(req, 1_000_000);
      // Modalità senza stato: un server e un trasporto per ogni richiesta.
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
    }
  });

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address();

  return {
    config: {
      mcpServers: {
        [MCP_NAME]: { type: "http", url: `http://127.0.0.1:${port}/mcp`, headers: { Authorization: `Bearer ${secret}` } },
      },
    },
    close: () => httpServer.close(),
  };
}
