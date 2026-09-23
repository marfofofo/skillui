// Esecuzione di processi e AppleScript, condivisa da strumenti e widget.

import { spawn } from "node:child_process";

const MAX_OUTPUT = 8000;

export function run(cmd, args = [], { input, timeout = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Timeout dopo ${timeout / 1000}s`));
    }, timeout);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    child.stdin.end(input ?? "");
  });
}

export function clip(text) {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…[troncato]` : text;
}

export function formatResult({ code, stdout, stderr }) {
  const parts = [];
  if (stdout) parts.push(stdout);
  if (stderr) parts.push(`stderr: ${stderr}`);
  if (code !== 0) parts.push(`exit code: ${code}`);
  return clip(parts.join("\n") || "OK");
}

// Esegue AppleScript passando i valori come argv, così il testo dell'utente
// non viene mai interpolato dentro lo script.
export async function osascript(lines, args = []) {
  const flags = lines.flatMap((l) => ["-e", l]);
  const res = await run("osascript", [...flags, ...args]);
  if (res.code !== 0) throw new Error(res.stderr || `osascript exit ${res.code}`);
  return res.stdout;
}
