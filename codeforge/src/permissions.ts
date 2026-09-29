import path from "node:path";
import type { PermissionMode } from "./config.js";
import type { Tool } from "./tools/types.js";

export type Decision = { allow: true } | { allow: false; reason: string };
export type Answer = "yes" | "always" | "no";
export type Asker = (tool: Tool, summary: string) => Promise<Answer>;

const FILE_TOOLS = new Set(["Read", "Write", "Edit"]);
const EDIT_TOOLS = new Set(["Write", "Edit"]);

interface Rule {
  tool: string;
  content?: string;
}

export function parseRule(rule: string): Rule {
  const m = /^([^(]+)(?:\((.*)\))?$/.exec(rule.trim());
  if (!m) return { tool: rule.trim() };
  return { tool: m[1].trim(), content: m[2]?.trim() };
}

function globToRegex(glob: string): RegExp {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${re}$`);
}

function contentMatches(pattern: string, value: string): boolean {
  if (pattern.endsWith(":*")) return value === pattern.slice(0, -2) || value.startsWith(pattern.slice(0, -2) + " ");
  if (pattern.includes("*") || pattern.includes("?")) return globToRegex(pattern).test(value);
  return pattern === value;
}

/**
 * Split a shell command into simple commands so an allow rule for `npm test:*`
 * cannot approve `npm test && rm -rf ~`. Returns undefined when the command
 * uses substitution, which rules never auto-approve.
 */
export function splitShell(command: string): string[] | undefined {
  if (/\$\(|`|<\(|>\(/.test(command)) return undefined;
  return command
    .split(/&&|\|\||;|\||\n/)
    .map((c) => c.trim())
    .filter(Boolean);
}

export class Permissions {
  private allow: Rule[];
  private deny: Rule[];

  constructor(
    public mode: PermissionMode,
    allow: string[],
    deny: string[],
    private cwd: string,
    private ask: Asker | undefined,
  ) {
    this.allow = allow.map(parseRule);
    this.deny = deny.map(parseRule);
  }

  setAsker(ask: Asker | undefined) {
    this.ask = ask;
  }

  private content(tool: Tool, input: unknown): string | undefined {
    const raw = tool.ruleContent?.(input);
    if (raw !== undefined && FILE_TOOLS.has(tool.name)) return path.relative(this.cwd, path.resolve(this.cwd, raw)) || ".";
    return raw;
  }

  private matches(rules: Rule[], tool: Tool, content: string | undefined): boolean {
    return rules.some((r) => {
      if (r.tool !== tool.name) return false;
      if (r.content === undefined || r.content === "*") return true;
      if (content === undefined) return false;
      if (tool.name === "Bash") {
        const parts = splitShell(content);
        return parts !== undefined && parts.length > 0 && parts.every((p) => contentMatches(r.content!, p));
      }
      return contentMatches(r.content, content);
    });
  }

  private matchesDeny(tool: Tool, content: string | undefined): boolean {
    if (tool.name === "Bash" && content !== undefined) {
      // A deny rule hits if any piece of the command matches it.
      const parts = splitShell(content) ?? [content];
      return this.deny.some(
        (r) => r.tool === "Bash" && (r.content === undefined || parts.some((p) => contentMatches(r.content!, p))),
      );
    }
    return this.matches(this.deny, tool, content);
  }

  async check(tool: Tool, input: unknown): Promise<Decision> {
    const content = this.content(tool, input);
    if (this.matchesDeny(tool, content)) return { allow: false, reason: `Denied by a permission rule for ${tool.name}.` };
    if (tool.readOnly) return { allow: true };
    if (this.mode === "plan") {
      return { allow: false, reason: "Plan mode is on: do not modify anything. Investigate, then present your plan to the user." };
    }
    if (this.mode === "bypassPermissions") return { allow: true };
    const insideCwd = content !== undefined && !content.startsWith("..") && !path.isAbsolute(content);
    if (this.mode === "acceptEdits" && EDIT_TOOLS.has(tool.name) && insideCwd) return { allow: true };
    if (this.matches(this.allow, tool, content)) return { allow: true };

    if (!this.ask) return { allow: false, reason: `Permission to use ${tool.name} was not granted (non-interactive session).` };
    const answer = await this.ask(tool, tool.summarize(input));
    if (answer === "no") return { allow: false, reason: "The user declined this tool call. Ask them how to proceed." };
    if (answer === "always") this.allow.push(this.suggestRule(tool, content));
    return { allow: true };
  }

  /** The session rule added when the user answers "always". */
  suggestRule(tool: Tool, content: string | undefined): Rule {
    if (tool.name === "Bash" && content) {
      const first = (splitShell(content) ?? [content])[0].split(/\s+/).slice(0, 2).join(" ");
      return { tool: "Bash", content: `${first}:*` };
    }
    if (EDIT_TOOLS.has(tool.name)) return { tool: tool.name };
    return { tool: tool.name, content };
  }
}
