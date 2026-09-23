// Sceglie il motore: Claude Code (predefinito, nessuna API key) oppure la Claude API.

import { config } from "../config.js";

export async function createEngine() {
  const engine =
    config.engine === "api"
      ? new (await import("./api.js")).ApiEngine()
      : new (await import("./claude-code.js")).ClaudeCodeEngine();
  await engine.start();
  return engine;
}

export function isAbort(err) {
  return err?.name === "AbortError" || err?.constructor?.name === "APIUserAbortError" || err?.message === "Annullato";
}

export function describeError(engine, err) {
  return engine.describeError?.(err) ?? err?.message ?? String(err);
}
