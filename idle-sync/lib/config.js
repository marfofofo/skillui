// Configurazione: legge .env (se c'è) e le variabili d'ambiente. Va importato per primo.

import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  // Nessun file .env: valgono solo le variabili d'ambiente.
}

const env = process.env;

export const config = {
  version: "2.1",
  port: Number(env.PORT || 8788),
  https: env.HTTPS !== "off",
  // "claude-code" usa la CLI già autenticata sul Mac; "api" usa ANTHROPIC_API_KEY.
  engine: env.ENGINE === "api" ? "api" : "claude-code",
  model: env.MODEL || "",
  claudeBin: env.CLAUDE_BIN || "claude",
  effort: ["low", "medium", "high"].includes(env.EFFORT) ? env.EFFORT : "low",
  autoApprove: env.AUTO_APPROVE === "true",
  fallbacks: env.FALLBACKS !== "off",
  demo: env.IDLE_DEMO === "1",
  host: os.hostname().replace(/\.local$/, ""),
  dataDir: path.join(ROOT, ".data"),
  publicDir: path.join(ROOT, "public"),
};
