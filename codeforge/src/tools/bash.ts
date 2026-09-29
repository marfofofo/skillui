import { spawn } from "node:child_process";
import { z } from "zod";
import { defineTool, truncate } from "./types.js";

export const BashTool = defineTool({
  name: "Bash",
  description:
    "Run a shell command in the working directory and return stdout, stderr and the exit code. " +
    "Default timeout 2 minutes (max 10). Prefer Read/Grep/Glob/Edit over cat/grep/find/sed. " +
    "Quote paths containing spaces. Avoid interactive commands.",
  schema: z.object({
    command: z.string(),
    description: z.string().optional().describe("5-10 word description of what the command does"),
    timeout: z.number().int().max(600_000).optional().describe("Timeout in milliseconds"),
  }),
  readOnly: false,
  summarize: (i) => i.command,
  ruleContent: (i) => i.command,
  run(input, ctx) {
    return new Promise((resolve) => {
      const child = spawn("bash", ["-c", input.command], {
        cwd: ctx.cwd,
        env: { ...process.env, CODEFORGE: "1" },
        detached: true,
      });
      let output = "";
      const append = (d: Buffer) => {
        output += d.toString();
        if (output.length > 2_000_000) output = output.slice(-1_000_000);
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);

      let reason: string | undefined;
      const kill = (why: string) => {
        reason = why;
        try {
          process.kill(-child.pid!, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      };
      const timer = setTimeout(() => kill(`timed out after ${input.timeout ?? 120_000}ms`), input.timeout ?? 120_000);
      const onAbort = () => kill("interrupted by user");
      ctx.signal.addEventListener("abort", onAbort, { once: true });

      child.on("close", (code) => {
        clearTimeout(timer);
        ctx.signal.removeEventListener("abort", onAbort);
        const body = truncate(output.trimEnd()) || "(no output)";
        if (reason) resolve(`${body}\n[command ${reason}]`);
        else resolve(code === 0 ? body : `${body}\n[exit code ${code}]`);
      });
      child.on("error", (e) => resolve(`Failed to start command: ${e.message}`));
    });
  },
});
