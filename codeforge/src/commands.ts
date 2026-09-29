import chalk from "chalk";
import type { Agent } from "./agent.js";
import type { Effort, PermissionMode } from "./config.js";
import type { MarkdownEntry, MemoryFile } from "./context.js";
import type { McpConnection } from "./mcp.js";
import { SessionStore } from "./session.js";

export interface ReplState {
  agent: Agent;
  cwd: string;
  session: SessionStore;
  memory: MemoryFile[];
  skills: Map<string, MarkdownEntry>;
  commands: Map<string, MarkdownEntry>;
  mcp: McpConnection[];
  setMode(mode: PermissionMode): void;
  getMode(): PermissionMode;
  newSession(store: SessionStore): void;
}

export type CommandResult = { type: "handled" } | { type: "prompt"; text: string } | { type: "exit" } | { type: "compact"; instructions?: string };

const MODES: PermissionMode[] = ["default", "acceptEdits", "plan", "bypassPermissions"];
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

const INIT_PROMPT = `Analyze this codebase and create a CODEFORGE.md file in the project root (or improve the existing one) for future agent sessions. Include:
- The commands to build, lint, and run tests, including a single test.
- The high-level architecture: the parts that need several files to understand.
Keep it concise. Skip generic advice and do not list every file. If there are existing AGENTS.md, CLAUDE.md, README or rules files, fold in what matters.`;

const BUILTIN: Record<string, string> = {
  help: "Show commands",
  clear: "Start a new conversation",
  compact: "Summarize the conversation to free context [focus instructions]",
  model: "Show or set the model",
  effort: "Show or set reasoning effort (low|medium|high|xhigh|max)",
  mode: "Show or set permission mode (default|acceptEdits|plan|bypassPermissions)",
  cost: "Show token usage for this session",
  context: "Show current context size",
  init: "Create a CODEFORGE.md for this project",
  memory: "List loaded memory files",
  resume: "List past sessions, or resume one by id",
  mcp: "Show MCP servers and their tools",
  skills: "List available skills",
  todos: "Show the current todo list",
  exit: "Quit",
};

export function handleCommand(line: string, s: ReplState): CommandResult {
  const [cmd, ...rest] = line.slice(1).split(/\s+/);
  const arg = rest.join(" ").trim();
  const print = (msg: string) => console.log(msg);

  switch (cmd) {
    case "help": {
      print(chalk.bold("Commands"));
      for (const [k, v] of Object.entries(BUILTIN)) print(`  /${k.padEnd(10)} ${chalk.dim(v)}`);
      for (const c of s.commands.values()) print(`  /${c.name.padEnd(10)} ${chalk.dim(c.description)} ${chalk.dim("(custom)")}`);
      print(chalk.dim("\nEnd a line with \\ for multi-line input. Ctrl+C interrupts a running turn; twice at the prompt exits."));
      return { type: "handled" };
    }
    case "exit":
    case "quit":
      return { type: "exit" };
    case "clear":
      s.agent.clear();
      s.newSession(new SessionStore(s.cwd));
      print(chalk.dim("Conversation cleared."));
      return { type: "handled" };
    case "compact":
      return { type: "compact", instructions: arg || undefined };
    case "model":
      if (arg) s.agent.opts.model = arg;
      print(`Model: ${s.agent.opts.model}`);
      return { type: "handled" };
    case "effort":
      if (arg) {
        if (!EFFORTS.includes(arg as Effort)) print(chalk.red(`Effort must be one of ${EFFORTS.join(", ")}`));
        else s.agent.opts.effort = arg as Effort;
      }
      print(`Effort: ${s.agent.opts.effort}`);
      return { type: "handled" };
    case "mode":
      if (arg) {
        if (!MODES.includes(arg as PermissionMode)) print(chalk.red(`Mode must be one of ${MODES.join(", ")}`));
        else s.setMode(arg as PermissionMode);
      }
      print(`Permission mode: ${s.getMode()}`);
      return { type: "handled" };
    case "cost": {
      const u = s.agent.usage;
      print(`Input: ${u.input}  Output: ${u.output}  Cache read: ${u.cacheRead}  Cache write: ${u.cacheWrite}`);
      return { type: "handled" };
    }
    case "context":
      print(`Context: ~${s.agent.contextTokens} tokens, ${s.agent.messages.length} messages (auto-compact at ${s.agent.opts.autoCompactTokens})`);
      return { type: "handled" };
    case "init":
      return { type: "prompt", text: INIT_PROMPT };
    case "memory":
      if (s.memory.length === 0) print("No memory files. Run /init to create CODEFORGE.md.");
      for (const m of s.memory) print(`  ${m.path} ${chalk.dim(`(${m.content.length} chars)`)}`);
      return { type: "handled" };
    case "resume": {
      if (!arg) {
        const list = SessionStore.list(s.cwd).slice(0, 15);
        if (list.length === 0) print("No saved sessions for this directory.");
        for (const x of list) print(`  ${x.id.slice(0, 8)}  ${chalk.dim(x.updated.slice(0, 16).replace("T", " "))}  ${x.title}`);
        return { type: "handled" };
      }
      const loaded = SessionStore.load(s.cwd, arg);
      if (!loaded) print(chalk.red(`No session matching ${arg}`));
      else {
        s.agent.clear();
        s.agent.messages = loaded.session.messages;
        s.newSession(loaded.store);
        print(chalk.dim(`Resumed ${loaded.session.id.slice(0, 8)}: ${loaded.session.title}`));
      }
      return { type: "handled" };
    }
    case "mcp":
      if (s.mcp.length === 0) print("No MCP servers configured (add mcpServers to .codeforge/settings.json).");
      for (const c of s.mcp) {
        print(`  ${c.name}: ${c.error ? chalk.red(`failed – ${c.error}`) : chalk.green(`${c.tools.length} tools`)}`);
        for (const t of c.tools) print(chalk.dim(`    ${t.name}`));
      }
      return { type: "handled" };
    case "skills":
      if (s.skills.size === 0) print("No skills. Add .codeforge/skills/<name>/SKILL.md");
      for (const sk of s.skills.values()) print(`  ${sk.name} ${chalk.dim(sk.description)}`);
      return { type: "handled" };
    case "todos": {
      const todos = s.agent.opts.context.todos;
      if (todos.length === 0) print("No todos.");
      for (const t of todos) print(`  ${t.status === "completed" ? "✔" : t.status === "in_progress" ? "▸" : "○"} ${t.content}`);
      return { type: "handled" };
    }
  }

  const custom = s.commands.get(cmd);
  if (custom) return { type: "prompt", text: custom.body.replaceAll("$ARGUMENTS", arg) };
  const skill = s.skills.get(cmd);
  if (skill) return { type: "prompt", text: `${skill.body}\n\n${arg}` };
  print(chalk.red(`Unknown command /${cmd}. Type /help.`));
  return { type: "handled" };
}
