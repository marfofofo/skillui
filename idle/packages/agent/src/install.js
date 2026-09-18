// "IDLE" — writing ourselves into someone else's settings file.
//
// Rules, in order of importance:
//   1. Never lose a line of the user's own configuration.
//   2. Be idempotent: linking twice leaves exactly one set of entries.
//   3. Be removable: `idle unlink` takes out our entries and only ours.

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, copyFileSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { readJson, writeJsonAtomic } from "./config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BIN_PATH = join(HERE, "..", "bin", "idle.js");

/** Recognises our entries and nobody else's. */
export const IDLE_COMMAND_RE =
  /idle(-agent)?(\.js)?["']?\s+hook\s+(session-start|heartbeat|session-end)\b/i;

const quote = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);

export function resolveCommand(event, agent, options = {}) {
  const execPath = options.execPath ?? process.execPath;
  const scriptPath = options.scriptPath ?? BIN_PATH;
  return `${quote(execPath)} ${quote(scriptPath)} hook ${event} --agent ${agent}`;
}

/**
 * Which lifecycle event of each agent maps to which of our three.
 * PreToolUse is included for Claude Code because a long tool run is exactly
 * when a session looks dead but is most alive; the CLI's throttle absorbs it.
 */
export const CLAUDE_EVENTS = Object.freeze({
  SessionStart: "session-start",
  UserPromptSubmit: "heartbeat",
  PreToolUse: "heartbeat",
  Stop: "heartbeat",
  SessionEnd: "session-end",
});

export const CODEX_EVENTS = Object.freeze({
  SessionStart: "session-start",
  UserPromptSubmit: "heartbeat",
  Stop: "heartbeat",
  SessionEnd: "session-end",
});

function idleEntry(command) {
  return {
    type: "command",
    command,
    // async so a hook can never add latency to a coding session, and a short
    // timeout so a hung network is bounded.
    async: true,
    timeout: 5,
  };
}

/** Remove every "IDLE" entry from a settings object, leaving everything else. */
export function stripIdleHooks(settings) {
  const next = structuredClone(settings ?? {});
  if (!next.hooks || typeof next.hooks !== "object") return next;

  for (const [event, groups] of Object.entries(next.hooks)) {
    if (!Array.isArray(groups)) continue;

    const cleanedGroups = groups
      .map((group) => {
        if (!group || !Array.isArray(group.hooks)) return group;
        const hooks = group.hooks.filter(
          (hook) => !(typeof hook?.command === "string" && IDLE_COMMAND_RE.test(hook.command)),
        );
        return { ...group, hooks };
      })
      // A group we emptied was ours; a group that was already empty is theirs.
      .filter((group) => !Array.isArray(group?.hooks) || group.hooks.length > 0);

    if (cleanedGroups.length > 0) next.hooks[event] = cleanedGroups;
    else delete next.hooks[event];
  }

  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return next;
}

/** Add our entries to a settings object. Strips first, so it is idempotent. */
export function mergeIdleHooks(settings, eventMap, agent, options = {}) {
  const next = stripIdleHooks(settings);
  next.hooks ??= {};

  for (const [agentEvent, idleEvent] of Object.entries(eventMap)) {
    const command = resolveCommand(idleEvent, agent, options);
    const groups = Array.isArray(next.hooks[agentEvent]) ? next.hooks[agentEvent] : [];

    // Join the group that has no matcher (i.e. "all") if one exists, so we add
    // one entry rather than a parallel group the user has to reason about.
    const catchAll = groups.find(
      (group) => group && !group.matcher && Array.isArray(group.hooks),
    );

    if (catchAll) catchAll.hooks.push(idleEntry(command));
    else groups.push({ hooks: [idleEntry(command)] });

    next.hooks[agentEvent] = groups;
  }

  return next;
}

export function countIdleHooks(settings) {
  let count = 0;
  for (const groups of Object.values(settings?.hooks ?? {})) {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const hook of group?.hooks ?? []) {
        if (typeof hook?.command === "string" && IDLE_COMMAND_RE.test(hook.command)) count++;
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// TARGETS
// ---------------------------------------------------------------------------

export function claudeSettingsPath() {
  return process.env.CLAUDE_CONFIG_DIR
    ? join(process.env.CLAUDE_CONFIG_DIR, "settings.json")
    : join(homedir(), ".claude", "settings.json");
}

export function codexHooksPath() {
  return join(process.env.CODEX_HOME || join(homedir(), ".codex"), "hooks.json");
}

export function codexConfigPath() {
  return join(process.env.CODEX_HOME || join(homedir(), ".codex"), "config.toml");
}

function backup(path) {
  if (existsSync(path)) {
    try {
      copyFileSync(path, `${path}.idle-backup`);
    } catch {
      // A backup we cannot write is not a reason to refuse; the merge is
      // additive and reversible with `idle unlink`.
    }
  }
}

function applyTo(path, transform) {
  const before = readJson(path, {});
  const after = transform(before);
  backup(path);
  mkdirSync(dirname(path), { recursive: true });
  writeJsonAtomic(path, after, 0o644);
  return after;
}

/**
 * Codex needs a feature flag before it reads hooks at all. We only ever append,
 * and only when the key is absent, because editing TOML without a parser is how
 * you destroy someone's configuration.
 */
export function ensureCodexFeatureFlag(path = codexConfigPath()) {
  let current = "";
  if (existsSync(path)) {
    current = readFileSync(path, "utf8");
    if (/^\s*codex_hooks\s*=/m.test(current)) return "already-enabled";
    backup(path);
  } else {
    mkdirSync(dirname(path), { recursive: true });
  }

  const block =
    (current.endsWith("\n") || current === "" ? "" : "\n") +
    '\n# Added by "IDLE" — https://idle.app\n[features]\ncodex_hooks = true\n';

  appendFileSync(path, block, { mode: 0o644 });
  return "enabled";
}

export function installClaude(options = {}) {
  const path = options.path ?? claudeSettingsPath();
  applyTo(path, (settings) => mergeIdleHooks(settings, CLAUDE_EVENTS, "claude_code", options));
  return path;
}

export function installCodex(options = {}) {
  const path = options.path ?? codexHooksPath();
  applyTo(path, (settings) => mergeIdleHooks(settings, CODEX_EVENTS, "codex", options));
  ensureCodexFeatureFlag(options.configPath);
  return path;
}

export function uninstallFrom(path) {
  if (!existsSync(path)) return 0;
  const before = readJson(path, {});
  const removed = countIdleHooks(before);
  if (removed === 0) return 0;
  applyTo(path, stripIdleHooks);
  return removed;
}

export function installedCount(path) {
  return countIdleHooks(readJson(path, {}));
}
