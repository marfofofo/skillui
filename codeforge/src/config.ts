import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type PermissionMode = "default" | "acceptEdits" | "plan" | "bypassPermissions";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface HookConfig {
  /** Tool name, or a regex over tool names; empty matches every tool. */
  matcher?: string;
  command: string;
}

export type McpServerConfig =
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { url: string; headers?: Record<string, string> };

export interface Settings {
  model: string;
  effort: Effort;
  maxTokens: number;
  /** Server-side refusal fallback routing. */
  fallbacks: boolean;
  /** Anthropic-hosted web search tool. */
  webSearch: boolean;
  /** Input tokens at which the conversation is compacted automatically. */
  autoCompactTokens: number;
  permissions: { defaultMode: PermissionMode; allow: string[]; deny: string[] };
  hooks: { PreToolUse?: HookConfig[]; PostToolUse?: HookConfig[]; UserPromptSubmit?: HookConfig[]; Stop?: HookConfig[] };
  mcpServers: Record<string, McpServerConfig>;
}

export const DEFAULTS: Settings = {
  model: "claude-opus-5-5",
  effort: "high",
  maxTokens: 64_000,
  fallbacks: true,
  webSearch: true,
  autoCompactTokens: 700_000,
  permissions: { defaultMode: "default", allow: [], deny: [] },
  hooks: {},
  mcpServers: {},
};

export const HOME_DIR = process.env.CODEFORGE_HOME ?? path.join(os.homedir(), ".codeforge");

function readJson(file: string): Partial<Settings> {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e: any) {
    if (e?.code !== "ENOENT") console.error(`Ignoring invalid settings file ${file}: ${e.message}`);
    return {};
  }
}

/** User settings, then project settings, then local (gitignored) project settings. Later wins; lists concatenate. */
export function loadSettings(cwd: string): Settings {
  const layers = [
    path.join(HOME_DIR, "settings.json"),
    path.join(cwd, ".codeforge", "settings.json"),
    path.join(cwd, ".codeforge", "settings.local.json"),
  ].map(readJson);

  const s: Settings = structuredClone(DEFAULTS);
  for (const l of layers) {
    const { permissions, hooks, mcpServers, ...scalars } = l;
    Object.assign(s, scalars);
    if (permissions) {
      s.permissions.allow.push(...(permissions.allow ?? []));
      s.permissions.deny.push(...(permissions.deny ?? []));
      if (permissions.defaultMode) s.permissions.defaultMode = permissions.defaultMode;
    }
    for (const [event, list] of Object.entries(hooks ?? {})) {
      const key = event as keyof Settings["hooks"];
      s.hooks[key] = [...(s.hooks[key] ?? []), ...(list ?? [])];
    }
    Object.assign(s.mcpServers, mcpServers ?? {});
  }
  return s;
}
