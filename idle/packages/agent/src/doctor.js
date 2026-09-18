// IDLE — why your light is not on.
//
// This is the support question this product will get more than any other, and
// almost every cause of it is visible from the machine itself. Each check
// returns a verdict and, when something is wrong, the one thing to do about it.

import { existsSync, readFileSync, statSync } from "node:fs";
import { THROTTLE_MS } from "./constants.js";
import { readCredentials, readState, CREDENTIALS_PATH } from "./config.js";
import {
  claudeSettingsPath,
  codexHooksPath,
  installedCount,
  IDLE_COMMAND_RE,
} from "./install.js";
import { heartbeat } from "./api.js";
import { buildPayload } from "./hook.js";

/** @typedef {{ label: string, ok: boolean|null, detail: string, fix?: string }} Check */

/** The command strings our entries were installed with, across both agents. */
export function installedCommands(path) {
  if (!existsSync(path)) return [];
  let settings;
  try {
    settings = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return [];
  }

  const found = [];
  for (const groups of Object.values(settings?.hooks ?? {})) {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const hook of group?.hooks ?? []) {
        if (typeof hook?.command === "string" && IDLE_COMMAND_RE.test(hook.command)) {
          found.push(hook.command);
        }
      }
    }
  }
  return found;
}

/**
 * The script path out of a command we installed. Commands look like
 *   "/usr/bin/node" "/opt/idle/bin/idle.js" hook heartbeat --agent claude_code
 * and the quoting is ours, so this only has to understand our own format.
 */
export function scriptPathOf(command) {
  const quoted = command.match(/"([^"]+idle(?:-agent)?(?:\.js)?)"/i);
  if (quoted) return quoted[1];
  const bare = command.match(/(\S+idle(?:-agent)?\.js)/i);
  return bare ? bare[1] : null;
}

/**
 * The failure nobody guesses: upgrading the package, or a cleared npx cache,
 * moves the binary, and the absolute path written into settings.json a month ago
 * now points at nothing. The hook still "exists", it just silently never runs.
 */
export function brokenPaths(commands) {
  return commands
    .map(scriptPathOf)
    .filter((path) => path && !path.startsWith("npx") && !existsSync(path));
}

function ago(timestamp) {
  if (!timestamp) return "never";
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

/**
 * @returns {Promise<Check[]>} in the order they matter: the first failure is
 *          almost always the cause, so a reader can stop there.
 */
export async function diagnose({ probe = true } = {}) {
  const checks = [];

  const credentials = readCredentials();
  checks.push({
    label: "This terminal is paired",
    ok: !!credentials?.token,
    detail: credentials?.token
      ? `${credentials.handle ?? "—"} · ${CREDENTIALS_PATH}`
      : "no token on this machine",
    fix: "Get a code from the app under Settings, then: idle link <CODE>",
  });

  const claudePath = claudeSettingsPath();
  const claudeCommands = installedCommands(claudePath);
  checks.push({
    label: "Claude Code runs the hooks",
    ok: claudeCommands.length > 0,
    detail: claudeCommands.length
      ? `${claudeCommands.length} in ${claudePath}`
      : `nothing in ${claudePath}`,
    fix: "Run idle link again — it rewrites the hooks without touching your own settings",
  });

  const codexPath = codexHooksPath();
  const codexCommands = installedCommands(codexPath);
  checks.push({
    label: "Codex runs the hooks",
    // Not having Codex is not a problem, so this is informational.
    ok: codexCommands.length > 0 ? true : null,
    detail: codexCommands.length
      ? `${codexCommands.length} in ${codexPath}`
      : "Codex not set up on this machine",
  });

  const broken = brokenPaths([...claudeCommands, ...codexCommands]);
  checks.push({
    label: "Those hooks point at a real file",
    ok: broken.length === 0,
    detail: broken.length ? `missing: ${broken[0]}` : "yes",
    fix: "The package moved — upgrading or a cleared npx cache does this. Run idle link again",
  });

  const state = readState();
  const last = Number(state?.last_sent_at) || 0;
  checks.push({
    label: "A beat has been sent from here",
    ok: last > 0,
    detail: last ? `${state.last_event ?? "beat"} ${ago(last)}` : "never",
    fix: "Start a session in Claude Code. Hooks only run while an agent is running",
  });

  if (probe && credentials?.token) {
    let reachable = false;
    let detail = "no answer";
    try {
      const response = await heartbeat({
        token: credentials.token,
        payload: buildPayload("heartbeat", credentials.agent ?? null),
      });
      reachable = response.ok || response.status === 429;
      detail = response.ok
        ? "accepted"
        : response.status === 429
          ? "rate limited, which still means it is reachable"
          : response.status === 401
            ? "rejected this device token"
            : `answered ${response.status}`;
    } catch (error) {
      detail = error instanceof Error ? error.message : "unreachable";
    }
    checks.push({
      label: "The server accepts this device",
      ok: reachable,
      detail,
      fix: "If it rejected the token, the device was revoked in the app. Pair again",
    });
  }

  return checks;
}

export const THROTTLE_SECONDS = Math.round(THROTTLE_MS / 1000);
