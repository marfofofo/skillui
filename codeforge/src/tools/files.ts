import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { defineTool, ToolError, type ToolContext } from "./types.js";

export function resolvePath(ctx: ToolContext, p: string): string {
  return path.resolve(ctx.cwd, p);
}

async function mtime(file: string): Promise<number | undefined> {
  try {
    return (await fs.stat(file)).mtimeMs;
  } catch {
    return undefined;
  }
}

/** Refuse to overwrite a file the agent has not seen, or that changed since it was read. */
async function assertFresh(ctx: ToolContext, file: string): Promise<void> {
  const current = await mtime(file);
  if (current === undefined) return;
  const seen = ctx.readFiles.get(file);
  if (seen === undefined) throw new ToolError(`File has not been read yet. Read ${file} before modifying it.`);
  if (current > seen) throw new ToolError(`${file} was modified since it was last read. Read it again first.`);
}

export const ReadTool = defineTool({
  name: "Read",
  description:
    "Read a file from the local filesystem. Returns lines prefixed with line numbers (cat -n format). " +
    "Reads up to 2000 lines by default; use offset/limit for large files. Relative paths resolve against the working directory.",
  schema: z.object({
    file_path: z.string().describe("Path of the file to read"),
    offset: z.number().int().min(1).optional().describe("1-based line to start from"),
    limit: z.number().int().min(1).optional().describe("Number of lines to read"),
  }),
  readOnly: true,
  summarize: (i) => i.file_path,
  ruleContent: (i) => i.file_path,
  async run(input, ctx) {
    const file = resolvePath(ctx, input.file_path);
    const stat = await fs.stat(file).catch(() => undefined);
    if (!stat) throw new ToolError(`File does not exist: ${file}`);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(file, { withFileTypes: true });
      return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort().join("\n");
    }
    const text = await fs.readFile(file, "utf8");
    ctx.readFiles.set(file, stat.mtimeMs);
    if (text.length === 0) return "<file is empty>";
    const lines = text.split("\n");
    const start = (input.offset ?? 1) - 1;
    const end = Math.min(lines.length, start + (input.limit ?? 2000));
    const out: string[] = [];
    for (let i = start; i < end; i++) {
      const line = lines[i].length > 2000 ? lines[i].slice(0, 2000) + "…" : lines[i];
      out.push(`${String(i + 1).padStart(6)}\t${line}`);
    }
    if (end < lines.length) out.push(`\n[${lines.length - end} more lines; continue with offset=${end + 1}]`);
    return out.join("\n");
  },
});

export const WriteTool = defineTool({
  name: "Write",
  description:
    "Write a file, creating parent directories as needed and overwriting any existing file. " +
    "An existing file must be Read first. Prefer Edit for changes to existing files.",
  schema: z.object({
    file_path: z.string().describe("Path of the file to write"),
    content: z.string().describe("Full file contents"),
  }),
  readOnly: false,
  summarize: (i) => i.file_path,
  ruleContent: (i) => i.file_path,
  async run(input, ctx) {
    const file = resolvePath(ctx, input.file_path);
    await assertFresh(ctx, file);
    const existed = (await mtime(file)) !== undefined;
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, input.content, "utf8");
    ctx.readFiles.set(file, (await mtime(file))!);
    return `${existed ? "Updated" : "Created"} ${file} (${input.content.split("\n").length} lines)`;
  },
});

export const EditTool = defineTool({
  name: "Edit",
  description:
    "Replace an exact string in a file. old_string must match exactly (including indentation) and be unique " +
    "unless replace_all is true. The file must be Read first.",
  schema: z.object({
    file_path: z.string(),
    old_string: z.string().describe("Exact text to replace"),
    new_string: z.string().describe("Replacement text"),
    replace_all: z.boolean().optional().describe("Replace every occurrence"),
  }),
  readOnly: false,
  summarize: (i) => i.file_path,
  ruleContent: (i) => i.file_path,
  async run(input, ctx) {
    const file = resolvePath(ctx, input.file_path);
    if (input.old_string === input.new_string) throw new ToolError("old_string and new_string are identical.");
    if ((await mtime(file)) === undefined) throw new ToolError(`File does not exist: ${file}`);
    await assertFresh(ctx, file);
    const text = await fs.readFile(file, "utf8");
    const count = text.split(input.old_string).length - 1;
    if (count === 0) throw new ToolError("old_string not found in file.");
    if (count > 1 && !input.replace_all) {
      throw new ToolError(`old_string appears ${count} times. Add surrounding context to make it unique, or set replace_all.`);
    }
    const updated = input.replace_all
      ? text.split(input.old_string).join(input.new_string)
      : text.replace(input.old_string, () => input.new_string);
    await fs.writeFile(file, updated, "utf8");
    ctx.readFiles.set(file, (await mtime(file))!);
    return `Edited ${file} (${input.replace_all ? count : 1} replacement${count > 1 && input.replace_all ? "s" : ""})`;
  },
});
