// IDLE — the failures `idle doctor` exists to name.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brokenPaths, scriptPathOf, installedCommands } from "../src/doctor.js";
import { mergeIdleHooks, CLAUDE_EVENTS } from "../src/install.js";

test("the script path is read back out of a command we installed", () => {
  assert.equal(
    scriptPathOf('"/usr/bin/node" "/opt/idle/bin/idle.js" hook heartbeat --agent claude_code'),
    "/opt/idle/bin/idle.js",
  );
  assert.equal(
    scriptPathOf('/usr/bin/node /opt/idle/bin/idle.js hook session-start --agent codex'),
    "/opt/idle/bin/idle.js",
  );
});

test("including from a path with spaces in it", () => {
  assert.equal(
    scriptPathOf('"/usr/bin/node" "/Users/me/Application Support/idle/bin/idle.js" hook heartbeat --agent claude_code'),
    "/Users/me/Application Support/idle/bin/idle.js",
  );
});

test("a hook whose binary has moved is reported", () => {
  // The failure nobody guesses: upgrading the package or clearing the npx cache
  // moves the file, the absolute path in settings.json goes stale, and the hook
  // silently never runs again.
  const gone = brokenPaths([
    '"/usr/bin/node" "/gone/idle/bin/idle.js" hook heartbeat --agent claude_code',
  ]);
  assert.deepEqual(gone, ["/gone/idle/bin/idle.js"]);
});

test("a hook whose binary is still there is not", () => {
  const here = new URL("../bin/idle.js", import.meta.url).pathname;
  assert.deepEqual(brokenPaths([`"/usr/bin/node" "${here}" hook heartbeat --agent claude_code`]), []);
});

test("an npx-based plugin hook is never called broken", () => {
  // The plugin installs `npx --yes idle-agent hook ...`, which resolves at run
  // time and has no path to check.
  assert.deepEqual(
    brokenPaths(["npx --yes idle-agent hook heartbeat --agent claude_code"]),
    [],
  );
});

test("our commands are found in a real settings file, and nobody else's", () => {
  const dir = mkdtempSync(join(tmpdir(), "idle-doctor-"));
  const path = join(dir, "settings.json");

  const settings = mergeIdleHooks(
    {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "/home/me/guard.sh" }] },
        ],
      },
    },
    CLAUDE_EVENTS,
    "claude_code",
    { execPath: "/usr/bin/node", scriptPath: "/opt/idle/bin/idle.js" },
  );
  writeFileSync(path, JSON.stringify(settings));

  const found = installedCommands(path);
  assert.equal(found.length, 5);
  assert.equal(found.some((command) => command.includes("guard.sh")), false);

  rmSync(dir, { recursive: true, force: true });
});

test("a settings file that is missing or corrupt reports nothing rather than throwing", () => {
  const dir = mkdtempSync(join(tmpdir(), "idle-doctor-"));
  assert.deepEqual(installedCommands(join(dir, "nope.json")), []);

  const broken = join(dir, "broken.json");
  writeFileSync(broken, "{ this is not json");
  assert.deepEqual(installedCommands(broken), []);

  rmSync(dir, { recursive: true, force: true });
});
