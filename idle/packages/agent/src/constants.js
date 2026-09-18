// "IDLE" — constants shared by every command.

export const VERSION = "0.1.0";
export const CLIENT = `idle-agent/${VERSION}`;

/** Override for local development: IDLE_API_URL=http://127.0.0.1:54321/functions/v1 */
export const API_URL =
  process.env.IDLE_API_URL?.replace(/\/+$/, "") ||
  "https://api.idle.app/functions/v1";

export const AGENTS = Object.freeze({
  claude_code: "CLAUDE CODE",
  codex: "CODEX",
});

export const EVENTS = Object.freeze({
  "session-start": "session_start",
  heartbeat: "heartbeat",
  "session-end": "session_end",
});

/**
 * PreToolUse fires on every single tool call. Without a local throttle a long
 * agent run would produce thousands of requests, so the CLI sends at most one
 * heartbeat per THROTTLE_MS. The server's 8-minute decay window is ~5x this.
 */
export const THROTTLE_MS = 90_000;

/** A hook must never slow a coding session down. Everything here is best-effort. */
export const REQUEST_TIMEOUT_MS = 4_000;

/** How we recognise our own entries in someone else's settings file. */
export const HOOK_MARKER = "idle hook";
