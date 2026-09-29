import { execSync, type ExecSyncOptionsWithStringEncoding } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HOME_DIR } from "./config.js";

export interface MemoryFile {
  path: string;
  content: string;
}

export interface MarkdownEntry {
  name: string;
  description: string;
  body: string;
  path: string;
}

const MEMORY_NAMES = ["CODEFORGE.md", "AGENTS.md", "CLAUDE.md", ".codeforge/CODEFORGE.md", "CODEFORGE.local.md"];

function readIfExists(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

/** User memory, then project memory from the filesystem root down to cwd (closer files come later and win). */
export function loadMemory(cwd: string): MemoryFile[] {
  const out: MemoryFile[] = [];
  const user = path.join(HOME_DIR, "CODEFORGE.md");
  const userContent = readIfExists(user);
  if (userContent) out.push({ path: user, content: userContent });

  const dirs: string[] = [];
  for (let d = path.resolve(cwd); ; d = path.dirname(d)) {
    dirs.unshift(d);
    if (path.dirname(d) === d) break;
  }
  for (const dir of dirs) {
    if (dir === os.homedir() && dir !== cwd) continue;
    for (const name of MEMORY_NAMES) {
      const file = path.join(dir, name);
      const content = readIfExists(file);
      if (content?.trim()) out.push({ path: file, content: expandImports(content, path.dirname(file), 0) });
    }
  }
  return out;
}

/** `@path/to/file` on its own line inlines that file (max depth 3). */
function expandImports(content: string, baseDir: string, depth: number): string {
  if (depth >= 3) return content;
  return content.replace(/^@(\S+)\s*$/gm, (line, rel: string) => {
    const file = path.resolve(baseDir, rel.replace(/^~/, os.homedir()));
    const imported = readIfExists(file);
    return imported === undefined ? line : expandImports(imported, path.dirname(file), depth + 1);
  });
}

export function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { meta, body: m[2] };
}

function listDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/** Skills: <dir>/skills/<name>/SKILL.md with `name` and `description` frontmatter. Project skills override user skills. */
export function loadSkills(cwd: string): Map<string, MarkdownEntry> {
  const skills = new Map<string, MarkdownEntry>();
  for (const root of [path.join(HOME_DIR, "skills"), path.join(cwd, ".codeforge", "skills")]) {
    for (const dir of listDir(root)) {
      const file = path.join(root, dir, "SKILL.md");
      const text = readIfExists(file);
      if (!text) continue;
      const { meta, body } = parseFrontmatter(text);
      const name = meta.name ?? dir;
      skills.set(name, {
        name,
        description: meta.description ?? "",
        body: `Base directory for this skill: ${path.join(root, dir)}\n\n${body}`,
        path: file,
      });
    }
  }
  return skills;
}

/** Custom slash commands: <dir>/commands/<name>.md. `$ARGUMENTS` is replaced by what follows the command. */
export function loadCommands(cwd: string): Map<string, MarkdownEntry> {
  const commands = new Map<string, MarkdownEntry>();
  for (const root of [path.join(HOME_DIR, "commands"), path.join(cwd, ".codeforge", "commands")]) {
    for (const file of listDir(root).filter((f) => f.endsWith(".md"))) {
      const text = readIfExists(path.join(root, file))!;
      const { meta, body } = parseFrontmatter(text);
      const name = file.slice(0, -3);
      commands.set(name, { name, description: meta.description ?? body.split("\n")[0].slice(0, 80), body, path: path.join(root, file) });
    }
  }
  return commands;
}

function gitInfo(cwd: string): string {
  try {
    const opts: ExecSyncOptionsWithStringEncoding = { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", timeout: 3000 };
    const branch = execSync("git rev-parse --abbrev-ref HEAD", opts).trim();
    const status = execSync("git status --short", opts).trim().split("\n").slice(0, 30).join("\n");
    const log = execSync("git log --oneline -n 5", opts).trim();
    return `Git branch: ${branch}\nStatus:\n${status || "(clean)"}\nRecent commits:\n${log}`;
  } catch {
    return "Not a git repository";
  }
}

const BASE_PROMPT = `You are Codeforge, an agentic coding assistant running in the user's terminal. You help with software engineering: fixing bugs, adding features, refactoring, explaining code, running and debugging tests.

# How to work
- Understand before you change: search and read the relevant code first. Match the existing style, naming and libraries; never assume a dependency is available without checking.
- For multi-step work, track progress with TodoWrite and keep it current.
- Use the dedicated tools (Read, Edit, Write, Glob, Grep) instead of shell equivalents. Use Bash for builds, tests, git and other commands.
- Call independent tools in parallel in a single turn. Use Task for broad searches or research that would otherwise flood your context.
- After a change, verify it: run the project's tests, type checker or linter when they exist.
- Edit existing files rather than creating new ones. Do not create documentation files unless asked.
- Never commit, push, or take destructive or outward-facing actions unless the user asked. If a tool call is denied, adjust instead of retrying the same call.
- Never write secrets into code or logs.

# Communication
- Your output renders in a terminal as GitHub-flavored markdown. Be concise and direct; skip preamble and filler.
- Reference code as path:line.
- Report results honestly: if tests fail or a step was skipped, say so.
- Reply in the user's language.`;

export function buildSystemPrompt(opts: {
  cwd: string;
  model: string;
  memory: MemoryFile[];
  skills: Map<string, MarkdownEntry>;
  extra?: string;
}): string {
  const parts = [BASE_PROMPT];
  parts.push(
    `# Environment\nWorking directory: ${opts.cwd}\nPlatform: ${process.platform}\nModel: ${opts.model}\nToday's date: ${new Date().toISOString().slice(0, 10)}\n${gitInfo(opts.cwd)}`,
  );
  if (opts.skills.size) {
    const list = [...opts.skills.values()].map((s) => `- ${s.name}: ${s.description}`).join("\n");
    parts.push(`# Skills\nWhen a task matches one of these skills, load it with the Skill tool before starting:\n${list}`);
  }
  if (opts.memory.length) {
    const mem = opts.memory.map((m) => `Contents of ${m.path}:\n\n${m.content.trim()}`).join("\n\n");
    parts.push(`# Project and user instructions\nThese instructions override default behavior; follow them.\n\n${mem}`);
  }
  if (opts.extra) parts.push(opts.extra);
  return parts.join("\n\n");
}
