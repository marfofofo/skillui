import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerConfig } from "./config.js";
import { ToolError, truncate, type JsonSchema, type Tool } from "./tools/types.js";

export interface McpConnection {
  name: string;
  client?: Client;
  tools: Tool[];
  error?: string;
}

function wrapTool(server: string, client: Client, t: Awaited<ReturnType<Client["listTools"]>>["tools"][number]): Tool {
  const name = `mcp__${server}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return {
    name,
    description: t.description ?? `${t.name} (MCP server ${server})`,
    inputSchema: { ...(t.inputSchema as JsonSchema), type: "object" },
    readOnly: t.annotations?.readOnlyHint === true,
    // The MCP server validates its own arguments.
    parse: (input) => ({ ok: true, data: input ?? {} }),
    summarize: (input) => JSON.stringify(input).slice(0, 200),
    async run(input, ctx) {
      const result = await client.callTool({ name: t.name, arguments: input }, undefined, { signal: ctx.signal });
      const parts = (result.content as Array<{ type: string; text?: string; mimeType?: string }> | undefined) ?? [];
      const text = parts.map((p) => (p.type === "text" ? p.text : `[${p.type}${p.mimeType ? ` ${p.mimeType}` : ""}]`)).join("\n");
      if (result.isError) throw new ToolError(text || "MCP tool returned an error");
      return truncate(text || JSON.stringify(result.structuredContent ?? {}));
    },
  };
}

export async function connectMcpServers(servers: Record<string, McpServerConfig>, cwd: string): Promise<McpConnection[]> {
  return Promise.all(
    Object.entries(servers).map(async ([name, cfg]): Promise<McpConnection> => {
      try {
        const client = new Client({ name: "codeforge", version: "0.1.0" });
        const transport =
          "url" in cfg
            ? new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: cfg.headers } })
            : new StdioClientTransport({
                command: cfg.command,
                args: cfg.args,
                env: { ...(process.env as Record<string, string>), ...cfg.env },
                cwd,
                stderr: "ignore",
              });
        await client.connect(transport, { timeout: 30_000 });
        const { tools } = await client.listTools();
        return { name, client, tools: tools.map((t) => wrapTool(name, client, t)) };
      } catch (e) {
        return { name, tools: [], error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

export async function closeMcp(connections: McpConnection[]) {
  await Promise.allSettled(connections.map((c) => c.client?.close()));
}
