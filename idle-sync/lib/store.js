// Piccola persistenza su file JSON in .data/, con scrittura atomica.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";

mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });

export function jsonFile(name, fallback) {
  const file = path.join(config.dataDir, name);
  let value;
  try {
    value = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    value = fallback;
  }
  return {
    get: () => value,
    set(next) {
      value = next;
      writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 });
      renameSync(`${file}.tmp`, file);
    },
  };
}
