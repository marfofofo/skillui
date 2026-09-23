// Server che gira sul Mac: serve la web app per l'iPhone e parla con lui via WebSocket.

import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const { Session, describeError } = await import("./agent.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const DATA = path.join(HERE, ".data");
const PORT = Number(process.env.PORT || 8787);
const USE_HTTPS = process.env.HTTPS !== "off";

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn("⚠️  ANTHROPIC_API_KEY non impostata: copia .env.example in .env e inserisci la chiave.");
}

mkdirSync(DATA, { recursive: true });

// Codice di abbinamento: chi non lo conosce non può comandare il Mac.
const tokenFile = path.join(DATA, "token");
if (!existsSync(tokenFile)) writeFileSync(tokenFile, randomBytes(18).toString("base64url"), { mode: 0o600 });
const TOKEN = readFileSync(tokenFile, "utf8").trim();

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
    const base = ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "825", "-subj", "/CN=AI Remote"];
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

// Una sola conversazione condivisa: se l'iPhone si riconnette, riprende da dove era.
const session = new Session();
const pendingApprovals = new Map();
let current = null; // ultimo client connesso

function send(msg) {
  if (current?.readyState === 1) current.send(JSON.stringify(msg));
}

const io = {
  status: (text) => send({ type: "status", text }),
  tool: (name, detail) => send({ type: "tool", name, detail }),
  approve: (name, detail) =>
    new Promise((resolve) => {
      const id = randomUUID();
      pendingApprovals.set(id, resolve);
      send({ type: "approval", id, name, detail });
    }),
};

function rejectPendingApprovals() {
  for (const resolve of pendingApprovals.values()) resolve(false);
  pendingApprovals.clear();
}

async function handleCommand(text) {
  if (session.busy) {
    send({ type: "error", text: "Sto ancora lavorando al comando precedente." });
    return;
  }
  console.log(`🎙️  ${text}`);
  send({ type: "busy", busy: true });
  try {
    const reply = await session.run(text, io);
    console.log(`🤖 ${reply}`);
    send({ type: "reply", text: reply });
  } catch (err) {
    const aborted = err?.name === "AbortError" || err?.constructor?.name === "APIUserAbortError" || err?.message === "Annullato";
    const text = aborted ? "Comando annullato." : describeError(err);
    if (!aborted) console.error(err);
    send({ type: aborted ? "status" : "error", text });
  } finally {
    rejectPendingApprovals();
    send({ type: "busy", busy: false });
  }
}

wss.on("connection", (ws) => {
  current = ws;
  console.log("📱 iPhone connesso");
  send({ type: "hello", host: os.hostname(), busy: session.busy });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "command":
        if (typeof msg.text === "string" && msg.text.trim()) handleCommand(msg.text.trim().slice(0, 4000));
        break;
      case "approval": {
        const resolve = pendingApprovals.get(msg.id);
        pendingApprovals.delete(msg.id);
        resolve?.(msg.ok === true);
        break;
      }
      case "cancel":
        session.cancel();
        rejectPendingApprovals();
        break;
      case "reset":
        session.reset();
        rejectPendingApprovals();
        send({ type: "status", text: "Nuova conversazione." });
        break;
      case "ping":
        send({ type: "pong" });
        break;
    }
  });

  ws.on("close", () => {
    if (current === ws) {
      current = null;
      // Senza telefono nessuno può approvare: le richieste in sospeso vengono rifiutate.
      rejectPendingApprovals();
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const scheme = USE_HTTPS ? "https" : "http";
  const hosts = lanAddresses();
  const urls = (hosts.length ? hosts : ["localhost"]).map((h) => `${scheme}://${h}:${PORT}/?t=${TOKEN}`);
  console.log("\n✅ AI Remote attivo. Apri questo indirizzo in Safari sull'iPhone (stessa rete Wi-Fi):\n");
  for (const u of urls) console.log(`   ${u}`);
  console.log("");
  qrcode.generate(urls[0], { small: true });
  console.log("\nPoi: Condividi → Aggiungi alla schermata Home.\n");
});
