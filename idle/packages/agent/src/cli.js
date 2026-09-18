// "IDLE" — command router.

import { hostname } from "node:os";
import { existsSync } from "node:fs";
import { VERSION, API_URL } from "./constants.js";
import { readCredentials, writeCredentials, clearCredentials, readState, CREDENTIALS_PATH } from "./config.js";
import { pair } from "./api.js";
import { runHook } from "./hook.js";
import {
  installClaude,
  installCodex,
  uninstallFrom,
  installedCount,
  claudeSettingsPath,
  codexHooksPath,
} from "./install.js";
import { say, blank, rule, bold, dim, concrete, signal, meta, fail, WORDMARK } from "./ui.js";

function flag(args, name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function has(args, name) {
  return args.includes(`--${name}`);
}

// ---------------------------------------------------------------------------

function help() {
  blank();
  say(`  ${WORDMARK}   ${concrete('"SOCIAL NETWORK" FOR ENGINEERS')}`);
  blank();
  say(`  ${bold("idle link")} ${dim("<CODE>")}      pair this terminal with your account`);
  say(`  ${bold("idle status")}            what is linked, and when it last reported`);
  say(`  ${bold("idle unlink")}            remove the hooks and forget the token`);
  blank();
  say(`  ${concrete("Get your code from the app: SETTINGS → \"PAIR A TERMINAL\"")}`);
  blank();
  return 0;
}

// ---------------------------------------------------------------------------

async function link(args) {
  const raw = args.find((a) => !a.startsWith("--"));
  const code = (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (code.length !== 6) {
    fail(`A pairing code is six characters. ${dim("idle link K4M7QX")}`);
    return 1;
  }

  const label = flag(args, "label") ?? hostname();

  let result;
  try {
    result = await pair({ code, label, agent: null });
  } catch {
    fail("Could not reach the server. Check your connection and try again.");
    return 1;
  }

  if (!result.ok) {
    if (result.status === 429) fail("Too many attempts. Wait an hour.");
    else fail("That code is not valid any more. Generate a new one in the app.");
    return 1;
  }

  writeCredentials({
    token: result.payload.token,
    device_id: result.payload.device_id,
    handle: result.payload.handle,
    label,
    api_url: API_URL,
    linked_at: new Date().toISOString(),
  });

  const claudePath = claudeSettingsPath();
  const codexPath = codexHooksPath();
  const targets = [];

  try {
    installClaude();
    targets.push(["CLAUDE CODE", claudePath]);
  } catch (error) {
    fail(`Could not write ${claudePath}: ${error.message}`);
  }

  // Only touch Codex if the user actually has it.
  if (existsSync(codexPath) || existsSync(codexPath.replace(/hooks\.json$/, "config.toml"))) {
    try {
      installCodex();
      targets.push(["CODEX", codexPath]);
    } catch (error) {
      fail(`Could not write ${codexPath}: ${error.message}`);
    }
  }

  blank();
  say(`  ${WORDMARK}`);
  blank();
  say(`  ${bold((result.payload.handle ?? "you").toUpperCase())}  ${concrete("c/o")}  ${signal(targets.map(([name]) => name).join(" + ") || "—")}`);
  blank();
  rule();
  for (const [name, path] of targets) {
    say(`  ${meta("hooks")}  ${name.padEnd(12)} ${dim(path)}`);
  }
  say(`  ${meta("token")}  ${dim(CREDENTIALS_PATH)}`);
  rule();
  blank();
  say(`  ${concrete("Your friends see that you are building and which agent you use.")}`);
  say(`  ${concrete("Nothing else leaves this machine — idle.app/protocol")}`);
  blank();
  return 0;
}

// ---------------------------------------------------------------------------

function status() {
  const credentials = readCredentials();
  blank();
  say(`  ${WORDMARK}`);
  blank();

  if (!credentials?.token) {
    say(`  ${bold("TERMINAL NOT LINKED")}`);
    blank();
    say(`  ${concrete("Get a code from the app, then: ")}${bold("idle link <CODE>")}`);
    blank();
    return 1;
  }

  const state = readState();
  const claudeCount = installedCount(claudeSettingsPath());
  const codexCount = installedCount(codexHooksPath());
  const last = state.last_sent_at
    ? `${Math.round((Date.now() - state.last_sent_at) / 1000)}s ago`
    : "never";

  rule();
  say(`  ${meta("account")}   ${bold((credentials.handle ?? "—").toUpperCase())}`);
  say(`  ${meta("device")}    ${credentials.label ?? "—"}`);
  say(`  ${meta("hooks")}     CLAUDE CODE ${claudeCount ? signal(`${claudeCount} installed`) : concrete("none")}`);
  say(`  ${meta("hooks")}     CODEX       ${codexCount ? signal(`${codexCount} installed`) : concrete("none")}`);
  say(`  ${meta("last beat")} ${state.last_event ?? "—"} ${dim(last)}`);
  rule();
  blank();
  return 0;
}

// ---------------------------------------------------------------------------

function unlink() {
  const removed =
    uninstallFrom(claudeSettingsPath()) + uninstallFrom(codexHooksPath());
  clearCredentials();

  blank();
  say(`  ${WORDMARK}`);
  blank();
  say(`  ${bold("UNLINKED")}  ${concrete(`${removed} hook${removed === 1 ? "" : "s"} removed`)}`);
  blank();
  say(`  ${concrete("The device token on this machine is gone. Revoke it server-side")}`);
  say(`  ${concrete('in the app under SETTINGS → "DEVICES".')}`);
  blank();
  return 0;
}

// ---------------------------------------------------------------------------

export async function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;

  switch (command) {
    case "hook": {
      // The hot path. Never prints, never fails, never blocks.
      const [event] = args;
      const agent = flag(args, "agent") ?? null;
      try {
        await runHook(event, agent);
      } catch {
        // Deliberately silent.
      }
      return 0;
    }
    case "link":
      return link(args);
    case "status":
      return status();
    case "unlink":
      return unlink();
    case "--version":
    case "-v":
    case "version":
      say(VERSION);
      return 0;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return help();
    default:
      fail(`Unknown command: ${command}`);
      return help() || 1;
  }
}
