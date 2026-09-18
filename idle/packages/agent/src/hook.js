// "IDLE" — what a coding agent's lifecycle hook actually runs.
//
// This file is the privacy guarantee. Claude Code and Codex hand us a JSON
// payload on stdin containing cwd, transcript_path, prompt_id, tool inputs and
// the assistant's last message. We drain that stream and throw every byte away
// without parsing it, then build a request body from constants.
//
// If you are reviewing this package, review this file.

import { randomBytes } from "node:crypto";
import { CLIENT, EVENTS, THROTTLE_MS } from "./constants.js";
import { readCredentials, readState, writeState } from "./config.js";
import { heartbeat } from "./api.js";

/**
 * Consume stdin and return only how many bytes went past. The chunks are never
 * concatenated, never decoded, never inspected and never returned.
 *
 * @returns {Promise<number>} byte count, for diagnostics only
 */
export function redactedRead(stream) {
  return new Promise((resolve) => {
    if (!stream || stream.isTTY || stream.destroyed) return resolve(0);

    let bytes = 0;
    let settled = false;

    const onData = (chunk) => {
      bytes += chunk.length;
      // chunk goes out of scope here. That is the whole design.
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream.removeListener("data", onData);

      // Claude Code can leave the hook's stdin pipe open. A resumed stdin keeps
      // the event loop alive forever, so the process would never exit and the
      // agent would accumulate zombie hooks. Let it go, in every way Node offers.
      try {
        stream.pause();
        stream.unref?.();
        stream.destroy?.();
      } catch {
        // Nothing here is worth failing a heartbeat over.
      }

      resolve(bytes);
    };

    // A hook that hangs is worse than a hook that misses a beat. The timer is
    // deliberately NOT unref'd: we would rather hold the process open for one
    // second and still report presence than exit early and go dark.
    const timer = setTimeout(finish, 1_000);

    stream.on("data", onData);
    stream.once("end", finish);
    stream.once("error", finish);
    stream.once("close", finish);
  });
}

/**
 * The entire wire format. Four fields, all of them produced here, none of them
 * derived from stdin, the environment, the filesystem or the working directory.
 *
 * @see docs/PRESENCE_PROTOCOL.md §1
 */
export function buildPayload(event, agent) {
  return {
    event,
    agent,
    client: CLIENT,
    nonce: randomBytes(6).toString("hex"),
  };
}

/** Session boundaries always go out. Mid-session beats are throttled. */
export function shouldSend(event, state, now = Date.now()) {
  if (event === "session_start" || event === "session_end") return true;
  const last = Number(state?.last_sent_at) || 0;
  return now - last >= THROTTLE_MS;
}

export async function runHook(eventName, agent, { stdin = process.stdin } = {}) {
  // Drain stdin first and unconditionally: the agent is waiting on this pipe.
  await redactedRead(stdin);

  const event = EVENTS[eventName];
  if (!event) return 0;

  const credentials = readCredentials();
  if (!credentials?.token) return 0;

  const state = readState();
  if (!shouldSend(event, state)) return 0;

  // Record the attempt before it is made. A server we cannot reach must not
  // turn into a retry storm on the next tool call.
  writeState({ last_sent_at: Date.now(), last_event: event });

  try {
    await heartbeat({
      token: credentials.token,
      payload: buildPayload(event, agent ?? credentials.agent ?? null),
    });
  } catch {
    // Offline, DNS down, laptop on a train. Say nothing, do nothing.
  }

  return 0;
}
