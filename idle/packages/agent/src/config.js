// "IDLE" — everything the CLI keeps on disk, which is as little as possible.

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  unlinkSync,
  chmodSync,
} from "node:fs";

export const IDLE_DIR = process.env.IDLE_HOME || join(homedir(), ".idle");
export const CREDENTIALS_PATH = join(IDLE_DIR, "credentials.json");
export const STATE_PATH = join(IDLE_DIR, "state.json");

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

/** Write through a temp file so a crash can never leave half a config behind. */
export function writeJsonAtomic(path, value, mode = 0o600) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", { mode });
  renameSync(tmp, path);
  try {
    chmodSync(path, mode);
  } catch {
    // Windows and some network filesystems do not support this. Not fatal.
  }
}

export function readCredentials() {
  return readJson(CREDENTIALS_PATH);
}

export function writeCredentials(credentials) {
  writeJsonAtomic(CREDENTIALS_PATH, credentials, 0o600);
}

export function clearCredentials() {
  if (existsSync(CREDENTIALS_PATH)) unlinkSync(CREDENTIALS_PATH);
  if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH);
}

export function readState() {
  return readJson(STATE_PATH, { last_sent_at: 0, last_event: null });
}

export function writeState(state) {
  try {
    writeJsonAtomic(STATE_PATH, state, 0o600);
  } catch {
    // A read-only home directory degrades throttling, not the coding session.
  }
}
