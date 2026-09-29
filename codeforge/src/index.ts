#!/usr/bin/env node
import readline from "node:readline/promises";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { Agent, InterruptedError, type StreamFn } from "./agent.js";
import { handleCommand, type ReplState } from "./commands.js";
import { loadSettings, type Effort, type PermissionMode } from "./config.js";
import { buildSystemPrompt, loadCommands, loadMemory, loadSkills } from "./context.js";
import { Hooks } from "./hooks.js";
import { closeMcp, connectMcpServers } from "./mcp.js";
import { Permissions, type Asker } from "./permissions.js";
import { SessionStore } from "./session.js";
import { builtinTools, type Tool } from "./tools/index.js";
import { SubagentRenderer, TerminalRenderer } from "./ui.js";

const HELP = `codeforge — agentic coding in your terminal

Usage:
  codeforge [prompt]                 Start an interactive session (optionally with a first prompt)
  codeforge -p "prompt"              Run one prompt non-interactively and print the answer
  cat file | codeforge -p "explain"  Piped stdin is appended to the prompt

Options:
  -p, --print                        Non-interactive mode
  -c, --continue                     Continue the most recent session in this directory
  -r, --resume <id>                  Resume a session by id (prefix)
  -m, --model <model>                Model (default claude-opus-5-5)
      --effort <level>               low | medium | high | xhigh | max
      --permission-mode <mode>       default | acceptEdits | plan | bypassPermissions
      --dangerously-skip-permissions Same as --permission-mode bypassPermissions
      --allowed-tools <rules>        Comma-separated allow rules, e.g. "Bash(npm test:*),Edit"
      --disallowed-tools <rules>     Comma-separated deny rules
      --verbose                      Show full tool output
  -h, --help                         Show this help
`;

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const { values: args, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      print: { type: "boolean", short: "p" },
      continue: { type: "boolean", short: "c" },
      resume: { type: "string", short: "r" },
      model: { type: "string", short: "m" },
      effort: { type: "string" },
      "permission-mode": { type: "string" },
      "dangerously-skip-permissions": { type: "boolean" },
      "allowed-tools": { type: "string" },
      "disallowed-tools": { type: "string" },
      verbose: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const cwd = process.cwd();
  const settings = loadSettings(cwd);
  const model = args.model ?? settings.model;
  const mode = (args["dangerously-skip-permissions"] ? "bypassPermissions" : args["permission-mode"] ?? settings.permissions.defaultMode) as PermissionMode;
  const split = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
  // Piped stdin without -p also runs one prompt: readline cannot share a pipe with the prompt input.
  const interactive = !args.print && process.stdin.isTTY === true;

  let rl: readline.Interface | undefined;
  let controller = new AbortController();
  const ask: Asker = async (tool, summary) => {
    if (!rl) return "no";
    const q = `${chalk.yellow("?")} Allow ${chalk.bold(tool.name)}(${summary.slice(0, 300)})  ${chalk.dim("[y]es / [a]lways this session / [n]o")} `;
    const a = (await rl.question(q, { signal: controller.signal })).trim().toLowerCase();
    return a.startsWith("a") ? "always" : a.startsWith("y") || a === "" ? "yes" : "no";
  };

  const permissions = new Permissions(
    mode,
    [...settings.permissions.allow, ...split(args["allowed-tools"])],
    [...settings.permissions.deny, ...split(args["disallowed-tools"])],
    cwd,
    interactive ? ask : undefined,
  );
  const hooks = new Hooks(settings.hooks, cwd);
  const renderer = new TerminalRenderer(args.verbose);

  const memory = loadMemory(cwd);
  const skills = loadSkills(cwd);
  const commands = loadCommands(cwd);

  const mcp = await connectMcpServers(settings.mcpServers, cwd);
  for (const c of mcp) if (c.error) renderer.error(`MCP server ${c.name} failed to start: ${c.error}`);
  const tools: Tool[] = [...builtinTools(), ...mcp.flatMap((c) => c.tools)];

  const client = new Anthropic();
  const stream: StreamFn = (params, { signal }) => client.beta.messages.stream(params, { signal });
  const system = buildSystemPrompt({ cwd, model, memory, skills });
  const loadSkill = (name: string) => skills.get(name)?.body;

  const base = {
    stream,
    model,
    effort: (args.effort ?? settings.effort) as Effort,
    maxTokens: settings.maxTokens,
    permissions,
    hooks,
    fallbacks: settings.fallbacks,
    webSearch: settings.webSearch,
    autoCompactTokens: settings.autoCompactTokens,
  };

  let subagentCount = 0;
  const runSubagent = async (description: string, prompt: string, signal: AbortSignal) => {
    const sub = new Agent({
      ...base,
      model: agent.opts.model,
      system: buildSystemPrompt({
        cwd,
        model: agent.opts.model,
        memory,
        skills,
        extra:
          "# Subagent\nYou are a subagent launched by another agent for one task. Work autonomously; nobody will answer questions. " +
          "When done, reply with a concise, complete report of what you found or did — it is the only thing the caller sees.",
      }),
      tools: tools.filter((t) => t.name !== "Task"),
      renderer: new SubagentRenderer(`${description} #${++subagentCount}`),
      context: { cwd, readFiles: new Map(), todos: [], loadSkill },
    });
    const report = await sub.send(prompt, signal);
    return report || "(subagent returned no text)";
  };

  const agent = new Agent({
    ...base,
    system,
    tools,
    renderer,
    context: { cwd, readFiles: new Map(), todos: [], runSubagent, loadSkill },
  });

  let session = new SessionStore(cwd);
  if (args.continue || args.resume) {
    const loaded = SessionStore.load(cwd, args.resume);
    if (!loaded) renderer.error("No session to resume; starting a new one.");
    else {
      session = loaded.store;
      agent.messages = loaded.session.messages;
      renderer.info(`Resumed session ${loaded.session.id.slice(0, 8)}: ${loaded.session.title}`);
    }
  }

  const run = async (prompt: string): Promise<boolean> => {
    controller = new AbortController();
    try {
      await agent.send(prompt, controller.signal);
      renderer.blockEnd();
      return true;
    } catch (err) {
      renderer.blockEnd();
      if (err instanceof InterruptedError || controller.signal.aborted) renderer.error("Interrupted. What should I do instead?");
      else if (err instanceof Anthropic.AuthenticationError) renderer.error("Authentication failed: set ANTHROPIC_API_KEY.");
      else if (err instanceof Anthropic.RateLimitError) renderer.error("Rate limited. Wait a moment and retry.");
      else if (err instanceof Anthropic.APIError) renderer.error(`API error ${err.status}: ${err.message}`);
      else renderer.error(err instanceof Error ? err.stack ?? err.message : String(err));
      return false;
    } finally {
      session.save(agent.opts.model, agent.messages);
    }
  };

  // Non-interactive: one prompt, then exit.
  if (!interactive) {
    const stdin = await readStdin();
    const prompt = [positionals.join(" "), stdin].filter((s) => s.trim()).join("\n\n");
    if (!prompt) {
      process.stderr.write("No prompt given.\n");
      process.exitCode = 1;
    } else if (!(await run(prompt))) process.exitCode = 1;
    await closeMcp(mcp);
    return;
  }

  // Interactive REPL.
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, historySize: 500 });
  let running = false;
  let lastSigint = 0;
  rl.on("SIGINT", () => {
    if (running) {
      controller.abort();
      return;
    }
    if (Date.now() - lastSigint < 1500) {
      rl!.close();
      return;
    }
    lastSigint = Date.now();
    process.stdout.write(chalk.dim("\n(press Ctrl+C again to exit)\n"));
    rl!.write(null, { ctrl: true, name: "u" });
  });
  let closed = false;
  rl.on("close", () => (closed = true));

  const state: ReplState = {
    agent,
    cwd,
    get session() {
      return session;
    },
    memory,
    skills,
    commands,
    mcp,
    setMode: (m) => (permissions.mode = m),
    getMode: () => permissions.mode,
    newSession: (s) => (session = s),
  };

  console.log(
    `${chalk.bold.hex("#d97757")("✻ codeforge")} ${chalk.dim(`· ${model} · ${permissions.mode} · ${cwd}`)}\n` +
      chalk.dim(`${tools.length} tools${memory.length ? ` · ${memory.length} memory file(s)` : ""}${skills.size ? ` · ${skills.size} skill(s)` : ""} · /help for commands\n`),
  );

  let pending = positionals.join(" ").trim();
  while (!closed) {
    let input = pending;
    pending = "";
    if (!input) {
      try {
        const lines: string[] = [];
        let line = await rl.question(chalk.bold(lines.length ? "… " : "> "));
        while (line.endsWith("\\")) {
          lines.push(line.slice(0, -1));
          line = await rl.question(chalk.bold("… "));
        }
        lines.push(line);
        input = lines.join("\n").trim();
      } catch {
        break; // readline closed
      }
    }
    if (!input) continue;

    if (input.startsWith("/")) {
      const result = handleCommand(input, state);
      if (result.type === "exit") break;
      if (result.type === "compact") {
        running = true;
        controller = new AbortController();
        try {
          await agent.compact(controller.signal, result.instructions);
          renderer.info("Conversation compacted.");
          session.save(agent.opts.model, agent.messages);
        } catch (e) {
          renderer.error(`Compaction failed: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
          running = false;
        }
        continue;
      }
      if (result.type === "handled") continue;
      input = result.text;
    }

    running = true;
    await run(input);
    running = false;
    console.log();
  }

  rl.close();
  await closeMcp(mcp);
  console.log(chalk.dim(`Session saved. Resume with: codeforge --resume ${session.id.slice(0, 8)}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
