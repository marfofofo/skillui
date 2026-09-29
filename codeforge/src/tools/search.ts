import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { z } from "zod";
import { resolvePath } from "./files.js";
import { defineTool, ToolError, truncate } from "./types.js";

const IGNORE = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.next/**"];

export const GlobTool = defineTool({
  name: "Glob",
  description: 'Find files by glob pattern (e.g. "src/**/*.ts"). Returns paths sorted by modification time, newest first.',
  schema: z.object({
    pattern: z.string(),
    path: z.string().optional().describe("Directory to search in (defaults to the working directory)"),
  }),
  readOnly: true,
  summarize: (i) => i.pattern + (i.path ? ` in ${i.path}` : ""),
  async run(input, ctx) {
    const root = resolvePath(ctx, input.path ?? ".");
    const files = await fg(input.pattern, { cwd: root, ignore: IGNORE, dot: true, absolute: true, onlyFiles: true });
    const withTime = await Promise.all(
      files.map(async (f) => ({ f, t: (await fs.stat(f).catch(() => undefined))?.mtimeMs ?? 0 })),
    );
    withTime.sort((a, b) => b.t - a.t);
    if (withTime.length === 0) return "No files found";
    const shown = withTime.slice(0, 200).map((x) => x.f);
    return shown.join("\n") + (withTime.length > 200 ? `\n[${withTime.length - 200} more results truncated]` : "");
  },
});

function exec(cmd: string, args: string[], cwd: string, signal: AbortSignal): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, signal });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

let hasRg: boolean | undefined;

export const GrepTool = defineTool({
  name: "Grep",
  description:
    "Search file contents with a regular expression (ripgrep syntax). " +
    'output_mode: "files_with_matches" (default), "content" (matching lines with line numbers), or "count".',
  schema: z.object({
    pattern: z.string(),
    path: z.string().optional(),
    glob: z.string().optional().describe('Filter files, e.g. "*.ts"'),
    output_mode: z.enum(["files_with_matches", "content", "count"]).optional(),
    case_insensitive: z.boolean().optional(),
    context: z.number().int().min(0).optional().describe("Lines of context around matches (content mode)"),
  }),
  readOnly: true,
  summarize: (i) => `/${i.pattern}/` + (i.path ? ` in ${i.path}` : ""),
  async run(input, ctx) {
    const target = resolvePath(ctx, input.path ?? ".");
    const mode = input.output_mode ?? "files_with_matches";
    if (hasRg === undefined) hasRg = await exec("rg", ["--version"], ctx.cwd, ctx.signal).then((r) => r.code === 0, () => false);

    let result;
    if (hasRg) {
      const args = ["--no-heading", "--color=never"];
      if (mode === "files_with_matches") args.push("-l");
      if (mode === "count") args.push("-c");
      if (mode === "content") args.push("-n");
      if (input.case_insensitive) args.push("-i");
      if (input.context && mode === "content") args.push("-C", String(input.context));
      if (input.glob) args.push("--glob", input.glob);
      args.push("-e", input.pattern, target);
      result = await exec("rg", args, ctx.cwd, ctx.signal);
    } else {
      const args = ["-rE", "--exclude-dir=node_modules", "--exclude-dir=.git"];
      if (mode === "files_with_matches") args.push("-l");
      if (mode === "count") args.push("-c");
      if (mode === "content") args.push("-n");
      if (input.case_insensitive) args.push("-i");
      if (input.glob) args.push(`--include=${input.glob}`);
      args.push("-e", input.pattern, target);
      result = await exec("grep", args, ctx.cwd, ctx.signal);
    }
    if (result.code > 1) throw new ToolError(result.err.trim() || "search failed");
    const out = result.out.trim();
    if (!out) return "No matches found";
    const rel = out.split("\n").map((l) => (l.startsWith(ctx.cwd + path.sep) ? l.slice(ctx.cwd.length + 1) : l));
    return truncate(rel.slice(0, 500).join("\n") + (rel.length > 500 ? `\n[${rel.length - 500} more lines truncated]` : ""));
  },
});
