import { spawn } from "node:child_process";
import type { HookConfig, Settings } from "./config.js";

export type HookEvent = keyof Settings["hooks"];

export interface HookOutcome {
  /** Exit code 2 blocks the action; stderr becomes the reason fed back to the model. */
  blocked: boolean;
  message?: string;
}

function runOne(hook: HookConfig, payload: object, cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", hook.command], { cwd, env: { ...process.env, CODEFORGE_PROJECT_DIR: cwd } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (e) => resolve({ code: 1, stdout: "", stderr: e.message }));
    child.stdin.end(JSON.stringify(payload));
  });
}

/**
 * Shell hooks, configured in settings.json. Each receives a JSON payload on stdin.
 * Exit 0: continue (stdout is attached as extra context for PostToolUse / UserPromptSubmit).
 * Exit 2: block, with stderr as the reason. Anything else: a non-blocking error.
 */
export class Hooks {
  constructor(private config: Settings["hooks"], private cwd: string) {}

  async run(event: HookEvent, payload: { tool_name?: string } & Record<string, unknown>): Promise<HookOutcome> {
    const hooks = (this.config[event] ?? []).filter(
      (h) => !h.matcher || !payload.tool_name || new RegExp(`^(${h.matcher})$`).test(payload.tool_name),
    );
    const messages: string[] = [];
    for (const hook of hooks) {
      const r = await runOne(hook, { hook_event_name: event, cwd: this.cwd, ...payload }, this.cwd);
      if (r.code === 2) return { blocked: true, message: r.stderr.trim() || `Blocked by ${event} hook` };
      if (r.code === 0 && r.stdout.trim()) messages.push(r.stdout.trim());
      if (r.code !== 0) process.stderr.write(`[hook ${event}] exited ${r.code}: ${r.stderr.trim()}\n`);
    }
    return { blocked: false, message: messages.join("\n") || undefined };
  }
}
