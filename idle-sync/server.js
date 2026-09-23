// IDLE SYNC — server che gira sul Mac.
// Serve la web app e tiene sincronizzati tutti i dispositivi collegati (iPhone, iPad, browser):
// stessa conversazione, stessa cronologia, stesse impostazioni, stato del Mac in tempo reale.

import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));
} catch {
  // Nessun file .env: si usano le variabili d'ambiente già presenti.
}

// Import dinamici: agent.js legge le variabili d'ambiente appena caricato, quindi va importato dopo il .env.
const { WebSocketServer } = await import("ws");
const { default: qrcode } = await import("qrcode-terminal");
const { Session, EFFORTS, describeError, isAbort } = await import("./agent.js");
const { readMacStatus, runControl } = await import("./tools.js");

const VERSION = "2.0";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const DATA = path.join(HERE, ".data");
const PORT = Number(process.env.PORT || 8788);
const USE_HTTPS = process.env.HTTPS !== "off";
const STATUS_INTERVAL = 15_000;
const HISTORY_LIMIT = 100;

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn("⚠️  ANTHROPIC_API_KEY non impostata: copia .env.example in .env e inserisci la chiave.");
}

mkdirSync(DATA, { recursive: true });

// ---------------------------------------------------------------------------
// Persistenza su file (scrittura atomica)

function readJSON(name, fallback) {
  try {
    return JSON.parse(readFileSync(path.join(DATA, name), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(name, value) {
  const file = path.join(DATA, name);
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}

// Codice di abbinamento: chi non lo conosce non può comandare il Mac.
const tokenFile = path.join(DATA, "token");
if (!existsSync(tokenFile)) writeFileSync(tokenFile, randomBytes(18).toString("base64url"), { mode: 0o600 });
const TOKEN = readFileSync(tokenFile, "utf8").trim();

// ---------------------------------------------------------------------------
// Impostazioni condivise tra i dispositivi

const ICONS = ["play", "viewfinder", "moon", "laptop", "sparkles", "globe", "bulb", "mail", "speaker", "terminal"];

const DEFAULT_SETTINGS = {
  effort: EFFORTS.includes(process.env.EFFORT) ? process.env.EFFORT : "low",
  autoApprove: process.env.AUTO_APPROVE === "true",
  instructions: "",
  quickActions: [
    { id: "music", label: "Musica rilassante", icon: "play", prompt: "Metti un po' di musica rilassante su Spotify." },
    { id: "screen", label: "Cosa c'è sullo schermo?", icon: "viewfinder", prompt: "Guarda lo schermo e dimmi in breve cosa c'è." },
    { id: "focus", label: "Concentrazione", icon: "moon", prompt: "Chiudi le app di chat e social e abbassa il volume al 20." },
    { id: "mac", label: "Com'è messo il Mac?", icon: "laptop", prompt: "Dimmi in breve come sta il Mac: batteria, app aperta e volume." },
  ],
};

let settings = { ...DEFAULT_SETTINGS, ...readJSON("settings.json", {}) };

function sanitizeSettings(patch) {
  const next = { ...settings };
  if (EFFORTS.includes(patch.effort)) next.effort = patch.effort;
  if (typeof patch.autoApprove === "boolean") next.autoApprove = patch.autoApprove;
  if (typeof patch.instructions === "string") next.instructions = patch.instructions.slice(0, 2000);
  if (Array.isArray(patch.quickActions)) {
    next.quickActions = patch.quickActions
      .filter((a) => a && typeof a.label === "string" && typeof a.prompt === "string" && a.label.trim() && a.prompt.trim())
      .slice(0, 12)
      .map((a) => ({
        id: typeof a.id === "string" && a.id ? a.id.slice(0, 40) : randomUUID(),
        label: a.label.trim().slice(0, 40),
        prompt: a.prompt.trim().slice(0, 500),
        icon: ICONS.includes(a.icon) ? a.icon : "sparkles",
      }));
  }
  return next;
}

// ---------------------------------------------------------------------------
// Cronologia condivisa

let history = readJSON("history.json", []);

function addHistory(entry) {
  history.push(entry);
  if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
  writeJSON("history.json", history);
  broadcast({ type: "history:add", entry });
}

// ---------------------------------------------------------------------------
// HTTP(S) e file statici

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
}

// Safari su iOS consente il microfono solo su HTTPS: generiamo un certificato locale.
function ensureCertificate() {
  const key = path.join(DATA, "key.pem");
  const cert = path.join(DATA, "cert.pem");
  if (!existsSync(key) || !existsSync(cert)) {
    const host = os.hostname().replace(/\.local$/, "");
    const san = ["DNS:localhost", `DNS:${host}.local`, ...lanAddresses().map((ip) => `IP:${ip}`)].join(",");
    const base = ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "825", "-subj", "/CN=IDLE SYNC"];
    try {
      execFileSync("openssl", [...base, "-addext", `subjectAltName=${san}`], { stdio: "ignore" });
    } catch {
      execFileSync("openssl", base, { stdio: "ignore" });
    }
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep) || !existsSync(file)) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  res.end(readFileSync(file));
}

function tokenMatches(candidate) {
  const a = Buffer.from(String(candidate ?? ""));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const server = USE_HTTPS ? https.createServer(ensureCertificate(), serveStatic) : http.createServer(serveStatic);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname !== "/ws" || !tokenMatches(url.searchParams.get("t"))) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
});

// ---------------------------------------------------------------------------
// Dispositivi collegati

const clients = new Map(); // ws -> { id, device }

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients.keys()) if (ws.readyState === 1) ws.send(data);
}

function broadcastDevices() {
  broadcast({ type: "devices", devices: [...clients.values()].map((c) => ({ id: c.id, device: c.device })) });
}

// ---------------------------------------------------------------------------
// Stato del Mac per i widget

let macStatus = null;
let statusTimer = null;

async function refreshStatus() {
  try {
    const next = await readMacStatus();
    if (JSON.stringify(next) !== JSON.stringify(macStatus)) {
      macStatus = next;
      broadcast({ type: "mac", status: macStatus });
    }
  } catch (err) {
    console.error("Stato del Mac non disponibile:", err.message);
  }
}

function updatePolling() {
  if (clients.size > 0 && !statusTimer) {
    refreshStatus();
    statusTimer = setInterval(refreshStatus, STATUS_INTERVAL);
  } else if (clients.size === 0 && statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Conversazione condivisa

const session = new Session();
const pendingApprovals = new Map(); // id -> resolve

function resolveApproval(id, ok) {
  const resolve = pendingApprovals.get(id);
  if (!resolve) return;
  pendingApprovals.delete(id);
  resolve(ok);
  broadcast({ type: "approval:done", id, ok });
}

function rejectPendingApprovals() {
  for (const id of [...pendingApprovals.keys()]) resolveApproval(id, false);
}

async function handleCommand(text, origin) {
  if (session.busy) {
    send(origin.ws, { type: "toast", text: "Sto ancora lavorando al comando precedente." });
    return;
  }
  const exchange = { id: randomUUID(), ts: Date.now(), device: origin.device, user: text, reply: "", tools: [] };
  console.log(`🎙️  [${origin.device}] ${text}`);
  broadcast({ type: "command", id: exchange.id, text, origin: origin.id, device: origin.device });
  broadcast({ type: "busy", busy: true });

  const io = {
    step: () => broadcast({ type: "step" }),
    delta: (t) => broadcast({ type: "delta", text: t }),
    status: (t) => broadcast({ type: "status", text: t }),
    tool: (name, detail) => {
      exchange.tools.push(name);
      broadcast({ type: "tool", name, detail });
    },
    approve: (name, detail) =>
      new Promise((resolve) => {
        if (clients.size === 0) return resolve(false);
        const id = randomUUID();
        pendingApprovals.set(id, resolve);
        broadcast({ type: "approval", id, name, detail });
      }),
  };

  try {
    const reply = await session.run(text, io, settings);
    console.log(`🤖 ${reply}`);
    exchange.reply = reply;
    broadcast({ type: "reply", text: reply, origin: origin.id });
  } catch (err) {
    const aborted = isAbort(err);
    exchange.reply = aborted ? "Comando annullato." : describeError(err);
    if (!aborted) console.error(err);
    broadcast({ type: aborted ? "reply" : "error", text: exchange.reply, origin: origin.id });
  } finally {
    rejectPendingApprovals();
    broadcast({ type: "busy", busy: false });
    addHistory(exchange);
    refreshStatus();
  }
}

// ---------------------------------------------------------------------------
// Messaggi dai dispositivi

wss.on("connection", (ws) => {
  const client = { id: randomUUID(), device: "Dispositivo", ws };
  clients.set(ws, client);
  updatePolling();

  send(ws, {
    type: "hello",
    version: VERSION,
    you: client.id,
    host: os.hostname(),
    busy: session.busy,
    settings,
    history: history.slice(-50),
    mac: macStatus,
  });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "hi":
        client.device = String(msg.device || "Dispositivo").slice(0, 40);
        console.log(`📱 ${client.device} connesso (${clients.size} in totale)`);
        broadcastDevices();
        break;
      case "command":
        if (typeof msg.text === "string" && msg.text.trim()) handleCommand(msg.text.trim().slice(0, 4000), client);
        break;
      case "approval":
        resolveApproval(msg.id, msg.ok === true);
        break;
      case "cancel":
        session.cancel();
        rejectPendingApprovals();
        break;
      case "reset":
        session.reset();
        rejectPendingApprovals();
        broadcast({ type: "reset" });
        break;
      case "settings":
        settings = sanitizeSettings(msg.patch || {});
        writeJSON("settings.json", settings);
        broadcast({ type: "settings", settings });
        break;
      case "history:clear":
        history = [];
        writeJSON("history.json", history);
        broadcast({ type: "history:clear" });
        break;
      case "control":
        try {
          await runControl(String(msg.action), msg.value);
        } catch (err) {
          send(ws, { type: "toast", text: err.message });
        }
        await refreshStatus();
        break;
      case "ping":
        send(ws, { type: "pong" });
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    updatePolling();
    broadcastDevices();
    // Senza dispositivi nessuno può approvare: le richieste in sospeso vengono rifiutate.
    if (clients.size === 0) rejectPendingApprovals();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const scheme = USE_HTTPS ? "https" : "http";
  const hosts = lanAddresses();
  const urls = (hosts.length ? hosts : ["localhost"]).map((h) => `${scheme}://${h}:${PORT}/?t=${TOKEN}`);
  console.log(`\n✅ IDLE SYNC ${VERSION} attivo. Apri questo indirizzo in Safari su iPhone o iPad (stessa rete Wi-Fi):\n`);
  for (const u of urls) console.log(`   ${u}`);
  console.log("");
  qrcode.generate(urls[0], { small: true });
  console.log("\nPoi: Condividi → Aggiungi alla schermata Home. Puoi collegare più dispositivi insieme.\n");
});
