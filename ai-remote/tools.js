// Strumenti che Claude può usare per controllare il Mac.
// Ogni strumento ha una definizione (quella che vede il modello) e un'implementazione.
// Quelli con `needsApproval` vengono confermati dall'utente sull'iPhone prima di partire.

import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MAX_OUTPUT = 8000;

function run(cmd, args = [], { input, timeout = 30_000 } = {}) {
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

function clip(text) {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…[troncato]` : text;
}

function formatResult({ code, stdout, stderr }) {
  const parts = [];
  if (stdout) parts.push(stdout);
  if (stderr) parts.push(`stderr: ${stderr}`);
  if (code !== 0) parts.push(`exit code: ${code}`);
  return clip(parts.join("\n") || "OK");
}

// Esegue AppleScript passando i valori come argv, così il testo dell'utente
// non viene mai interpolato dentro lo script.
async function osascript(lines, args = []) {
  const flags = lines.flatMap((l) => ["-e", l]);
  const res = await run("osascript", [...flags, ...args]);
  if (res.code !== 0) throw new Error(res.stderr || `osascript exit ${res.code}`);
  return res.stdout;
}

function requireString(input, key) {
  const value = input?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Parametro "${key}" mancante o non valido`);
  }
  return value;
}

const KEY_CODES = {
  return: 36, enter: 76, tab: 48, space: 49, delete: 51, escape: 53,
  left: 123, right: 124, down: 125, up: 126,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
  home: 115, end: 119, pageup: 116, pagedown: 121,
};
const MODIFIERS = ["command", "option", "control", "shift"];

const tools = [
  {
    name: "open_app",
    description: "Apre (o porta in primo piano) un'applicazione del Mac, es. \"Safari\", \"Spotify\", \"Note\".",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Nome dell'app" } },
      required: ["name"],
    },
    async run(input) {
      return formatResult(await run("open", ["-a", requireString(input, "name")]));
    },
  },
  {
    name: "quit_app",
    description: "Chiude un'applicazione del Mac.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    async run(input) {
      await osascript(["on run argv", "tell application (item 1 of argv) to quit", "end run"], [requireString(input, "name")]);
      return "OK";
    },
  },
  {
    name: "open_url",
    description: "Apre un URL nel browser predefinito (o un link mailto:, facetime:, spotify:, ecc.). Utile anche per ricerche web: https://www.google.com/search?q=...",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
    async run(input) {
      const url = requireString(input, "url");
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url) || /^file:/i.test(url)) throw new Error("URL non valido");
      return formatResult(await run("open", [url]));
    },
  },
  {
    name: "get_status",
    description: "Restituisce lo stato del Mac: app in primo piano, finestra attiva, volume, batteria.",
    input_schema: { type: "object", properties: {} },
    async run() {
      const [front, volume, batt] = await Promise.all([
        osascript([
          'tell application "System Events"',
          "set p to first application process whose frontmost is true",
          "set w to \"\"",
          "try",
          "set w to name of front window of p",
          "end try",
          'return (name of p) & " — " & w',
          "end tell",
        ]).catch((e) => `n/d (${e.message})`),
        osascript(["get volume settings"]).catch(() => "n/d"),
        run("pmset", ["-g", "batt"]).then((r) => r.stdout).catch(() => "n/d"),
      ]);
      return `App in primo piano: ${front}\nVolume: ${volume}\nBatteria: ${batt}`;
    },
  },
  {
    name: "set_volume",
    description: "Imposta il volume di uscita del Mac (0-100) oppure attiva/disattiva il muto.",
    input_schema: {
      type: "object",
      properties: {
        level: { type: "integer", minimum: 0, maximum: 100 },
        muted: { type: "boolean" },
      },
    },
    async run(input) {
      if (typeof input.muted === "boolean") {
        await osascript([input.muted ? "set volume with output muted" : "set volume without output muted"]);
      }
      if (Number.isInteger(input.level)) {
        const level = Math.max(0, Math.min(100, input.level));
        await osascript([`set volume output volume ${level}`]);
      }
      return "OK";
    },
  },
  {
    name: "media_control",
    description: "Controlla la riproduzione musicale in Spotify o Musica.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["playpause", "play", "pause", "next", "previous", "now_playing"] },
        app: { type: "string", enum: ["Spotify", "Music"], description: "Predefinito: Spotify" },
      },
      required: ["action"],
    },
    async run(input) {
      const app = input.app === "Music" ? "Music" : "Spotify";
      const commands = {
        playpause: "playpause",
        play: "play",
        pause: "pause",
        next: "next track",
        previous: "previous track",
        now_playing: 'return (name of current track) & " — " & (artist of current track)',
      };
      const cmd = commands[input.action];
      if (!cmd) throw new Error("Azione non valida");
      return (await osascript([`tell application "${app}"`, cmd, "end tell"])) || "OK";
    },
  },
  {
    name: "type_text",
    description: "Digita del testo nell'app attualmente in primo piano, come se fosse scritto sulla tastiera.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    async run(input) {
      await osascript(
        ["on run argv", 'tell application "System Events" to keystroke (item 1 of argv)', "end run"],
        [requireString(input, "text")],
      );
      return "OK";
    },
  },
  {
    name: "press_keys",
    description:
      "Preme una combinazione di tasti nell'app in primo piano, es. key=\"t\" con modifiers=[\"command\"] per un nuovo tab, " +
      `oppure tasti speciali: ${Object.keys(KEY_CODES).join(", ")}.`,
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Un singolo carattere oppure il nome di un tasto speciale" },
        modifiers: { type: "array", items: { type: "string", enum: MODIFIERS } },
      },
      required: ["key"],
    },
    async run(input) {
      const key = requireString(input, "key");
      const mods = (Array.isArray(input.modifiers) ? input.modifiers : []).filter((m) => MODIFIERS.includes(m));
      const using = mods.length ? ` using {${mods.map((m) => `${m} down`).join(", ")}}` : "";
      const code = KEY_CODES[key.toLowerCase()];
      if (code !== undefined) {
        await osascript([`tell application "System Events" to key code ${code}${using}`]);
      } else if ([...key].length === 1) {
        await osascript(
          ["on run argv", `tell application "System Events" to keystroke (item 1 of argv)${using}`, "end run"],
          [key],
        );
      } else {
        throw new Error(`Tasto sconosciuto: ${key}`);
      }
      return "OK";
    },
  },
  {
    name: "take_screenshot",
    description: "Cattura lo schermo del Mac e te lo mostra, per capire cosa c'è a video prima di agire.",
    input_schema: { type: "object", properties: {} },
    async run() {
      const base = path.join(os.tmpdir(), `ai-remote-${Date.now()}`);
      const png = `${base}.png`;
      const jpg = `${base}.jpg`;
      try {
        const shot = await run("screencapture", ["-x", "-m", png]);
        if (shot.code !== 0) throw new Error(shot.stderr || "screencapture non riuscito");
        await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", "-Z", "1568", png, "--out", jpg]);
        const data = (await readFile(jpg)).toString("base64");
        return [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
          { type: "text", text: "Screenshot dello schermo principale." },
        ];
      } finally {
        await rm(png, { force: true });
        await rm(jpg, { force: true });
      }
    },
  },
  {
    name: "clipboard",
    description: "Legge o scrive gli appunti del Mac.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "write"] },
        text: { type: "string", description: "Testo da copiare (solo per write)" },
      },
      required: ["action"],
    },
    async run(input) {
      if (input.action === "write") {
        await run("pbcopy", [], { input: requireString(input, "text") });
        return "Copiato negli appunti.";
      }
      return clip((await run("pbpaste")).stdout || "(appunti vuoti)");
    },
  },
  {
    name: "notify",
    description: "Mostra una notifica sul Mac.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, message: { type: "string" } },
      required: ["message"],
    },
    async run(input) {
      await osascript(
        ["on run argv", "display notification (item 2 of argv) with title (item 1 of argv)", "end run"],
        [input.title || "AI Remote", requireString(input, "message")],
      );
      return "OK";
    },
  },
  {
    name: "speak_on_mac",
    description: "Pronuncia una frase dagli altoparlanti del Mac (voce di sistema).",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    async run(input) {
      return formatResult(await run("say", [requireString(input, "text")], { timeout: 120_000 }));
    },
  },
  {
    name: "list_shortcuts",
    description:
      "Elenca i Comandi Rapidi (app Shortcuts) disponibili sul Mac. Tramite i Comandi Rapidi si controllano anche " +
      "dispositivi esterni: luci e accessori di Casa (HomeKit), altri dispositivi Apple, automazioni.",
    input_schema: { type: "object", properties: {} },
    async run() {
      return formatResult(await run("shortcuts", ["list"]));
    },
  },
  {
    name: "run_shortcut",
    description: "Esegue un Comando Rapido per nome (vedi list_shortcuts), con un testo di input opzionale.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        input: { type: "string", description: "Testo passato come input al comando rapido" },
      },
      required: ["name"],
    },
    async run(input) {
      const args = ["run", requireString(input, "name")];
      const file = path.join(os.tmpdir(), `ai-remote-input-${Date.now()}.txt`);
      const hasInput = typeof input.input === "string" && input.input.length > 0;
      if (hasInput) {
        await writeFile(file, input.input);
        args.push("--input-path", file);
      }
      try {
        return formatResult(await run("shortcuts", args, { timeout: 120_000 }));
      } finally {
        if (hasInput) await rm(file, { force: true });
      }
    },
  },
  {
    name: "run_applescript",
    description:
      "Esegue uno script AppleScript arbitrario. Usalo per tutto ciò che gli altri strumenti non coprono " +
      "(controllare Finder, Safari, Mail, finestre, impostazioni…). Richiede conferma dell'utente.",
    needsApproval: true,
    input_schema: {
      type: "object",
      properties: { script: { type: "string" } },
      required: ["script"],
    },
    async run(input) {
      return formatResult(await run("osascript", ["-"], { input: requireString(input, "script"), timeout: 60_000 }));
    },
  },
  {
    name: "run_shell",
    description:
      "Esegue un comando nel terminale (zsh) del Mac e restituisce l'output. Richiede conferma dell'utente. " +
      "Evita comandi interattivi o che non terminano.",
    needsApproval: true,
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
    async run(input) {
      return formatResult(
        await run("/bin/zsh", ["-lc", requireString(input, "command")], { timeout: 60_000 }),
      );
    },
  },
];

const byName = new Map(tools.map((t) => [t.name, t]));

export const toolDefinitions = tools.map(({ name, description, input_schema }) => ({
  name,
  description,
  input_schema,
}));

export function getTool(name) {
  return byName.get(name);
}

// Testo breve da mostrare sull'iPhone quando l'AI usa uno strumento.
export function describeToolCall(name, input) {
  switch (name) {
    case "run_shell":
      return input.command;
    case "run_applescript":
      return input.script;
    case "open_app":
    case "quit_app":
    case "run_shortcut":
      return input.name;
    case "open_url":
      return input.url;
    case "type_text":
      return `"${input.text}"`;
    case "press_keys":
      return [...(input.modifiers ?? []), input.key].join("+");
    default:
      return Object.keys(input ?? {}).length ? JSON.stringify(input) : "";
  }
}
