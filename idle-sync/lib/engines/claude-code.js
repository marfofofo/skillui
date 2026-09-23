// Motore "claude-code": usa la CLI di Claude Code già installata e autenticata sul Mac.
// Nessuna API key: vale l'account con cui hai fatto login in `claude`.
//
// Ogni comando lancia `claude -p` in streaming (stream-json). Gli strumenti del Mac arrivano
// dal server MCP interno; la conversazione continua con --resume finché non la azzeri.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { config } from "../config.js";
import { SYSTEM_PROMPT, personalInstructions } from "../prompt.js";
import { MCP_NAME, startMcpServer } from "./mcp.js";

// Variabili che legherebbero il processo figlio a una sessione di Claude Code già aperta
// (succede se avvii IDLE SYNC da dentro Claude Code).
const INHERITED_SESSION_VARS = ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_REMOTE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION"];

export class AbortError extends Error {
  constructor() {
    super("Annullato");
    this.name = "AbortError";
  }
}

export class ClaudeCodeEngine {
  name = "Claude Code";

  constructor() {
    this.sessionId = null;
    this.child = null;
    this.context = null;
    this.mcp = null;
    this.workspace = path.join(config.dataDir, "workspace");
    mkdirSync(this.workspace, { recursive: true });
  }

  async start() {
    this.mcp = await startMcpServer(() => this.context);
  }

  get busy() {
    return this.context !== null;
  }

  reset() {
    this.cancel();
    this.sessionId = null;
  }

  cancel() {
    if (this.context) this.context.controller.abort();
    this.child?.kill("SIGTERM");
  }

  async run(text, io, settings) {
    if (this.busy) throw new Error("Sto già lavorando a un comando");
    const controller = new AbortController();
    this.context = { io, autoApprove: settings.autoApprove, signal: controller.signal, controller };
    try {
      try {
        return await this.invoke(text, io, settings, this.sessionId);
      } catch (err) {
        // Se la sessione salvata non esiste più (es. dopo un aggiornamento), si riparte da zero.
        if (!this.sessionId || err instanceof AbortError || !err.resumeFailed) throw err;
        this.sessionId = null;
        return await this.invoke(text, io, settings, null);
      }
    } finally {
      this.context = null;
      this.child = null;
    }
  }

  args(settings, resume) {
    const system = [SYSTEM_PROMPT, personalInstructions(settings.instructions)].filter(Boolean).join("\n\n");
    const args = [
      "-p",
      "--output-format", "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--system-prompt", system,
      "--mcp-config", JSON.stringify(this.mcp.config),
      "--strict-mcp-config",
      // Niente strumenti di codice: solo ricerca web e gli strumenti del Mac (MCP).
      "--tools", "WebSearch,WebFetch",
      "--allowedTools", `mcp__${MCP_NAME}`, "WebSearch", "WebFetch",
      "--permission-mode", "dontAsk",
      "--setting-sources", "project",
      "--effort", settings.effort,
    ];
    if (config.model) args.push("--model", config.model);
    if (resume) args.push("--resume", resume);
    return args;
  }

  invoke(text, io, settings, resume) {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      for (const key of INHERITED_SESSION_VARS) delete env[key];

      const child = spawn(config.claudeBin, this.args(settings, resume), { cwd: this.workspace, env });
      this.child = child;
      const { signal } = this.context;
      let result = null;
      let stderr = "";
      let streamed = false;

      child.on("error", (err) => {
        reject(
          err.code === "ENOENT"
            ? new Error("Claude Code non trovato sul Mac. Installalo e fai login con il comando «claude».")
            : err,
        );
      });
      child.stderr.on("data", (d) => (stderr += d));

      readline.createInterface({ input: child.stdout }).on("line", (line) => {
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (event.session_id) this.sessionId = event.session_id;

        if (event.type === "stream_event") {
          const e = event.event;
          if (e.type === "message_start") io.step();
          else if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
            streamed = true;
            io.delta(e.delta.text);
          }
        } else if (event.type === "assistant") {
          // Testo scritto prima di usare uno strumento: diventa lo stato mostrato sul telefono.
          const blocks = event.message?.content ?? [];
          const said = blocks.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
          if (said && blocks.some((b) => b.type === "tool_use")) io.status(said);
        } else if (event.type === "result") {
          result = event;
        }
      });

      child.on("close", (code) => {
        if (signal.aborted) return reject(new AbortError());
        if (result && !result.is_error) return resolve((result.result || "").trim() || "Fatto.");

        const message = (result?.result || result?.errors?.join(" ") || stderr.trim().split("\n").pop() || `Claude Code è uscito con codice ${code}`).trim();
        const err = new Error(message);
        err.resumeFailed = Boolean(resume) && !streamed && /conversation|session/i.test(message);
        reject(err);
      });

      child.stdin.end(text);
    });
  }
}
