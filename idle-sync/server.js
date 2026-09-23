// IDLE SYNC — server che gira sul Mac.
// Serve la web app, abbina i dispositivi e li tiene sincronizzati.

import { config } from "./lib/config.js";
import readline from "node:readline";
import QRCode from "qrcode";
import { WebSocketServer } from "ws";
import { createEngine } from "./lib/engines/index.js";
import { CLOSE_UNPAIRED, Hub } from "./lib/hub.js";
import { Pairing, PairingError } from "./lib/pairing.js";
import { baseUrl, clientIp, createWebServer, readJson, sendJson, serveStatic } from "./lib/web.js";

const engine = await createEngine();
const pairing = new Pairing();
const hub = new Hub({ engine, pairing });

// ---------------------------------------------------------------------------
// Codice di abbinamento nel terminale

async function printPairingCode({ code, url, expiresAt }) {
  const qr = await QRCode.toString(url, { type: "terminal", small: true });
  const expiry = expiresAt ? `valido ${Math.round((expiresAt - Date.now()) / 60_000)} minuti, ` : "";
  console.log(`\n🔗 Abbina un dispositivo: inquadra il QR oppure apri ${baseUrl()} e inserisci il codice\n`);
  console.log(`      ${code.slice(0, 3)} ${code.slice(3)}   (${expiry}monouso)\n`);
  console.log(qr);
}

hub.onPairingCode = (info) => printPairingCode(info).catch(() => {});

// ---------------------------------------------------------------------------
// HTTP: web app e abbinamento

async function handleRequest(req, res) {
  const { pathname } = new URL(req.url, "http://x");

  if (pathname === "/api/pair" && req.method === "POST") {
    try {
      const { code, name } = await readJson(req);
      const { token, device } = pairing.pair(code, name, clientIp(req));
      console.log(`✅ Abbinato: ${device.name}`);
      hub.broadcastDevices();
      return sendJson(res, 200, { token, device });
    } catch (err) {
      return sendJson(res, err instanceof PairingError ? err.status : 400, { error: err.message });
    }
  }

  if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "Non trovato" });
  serveStatic(req, res);
}

const server = createWebServer((req, res) => {
  handleRequest(req, res).catch((err) => sendJson(res, 500, { error: err.message }));
});

// ---------------------------------------------------------------------------
// WebSocket: solo dispositivi abbinati

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname !== "/ws") return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    const device = pairing.verify(url.searchParams.get("t"));
    // Il close code dice al telefono di mostrare la schermata di abbinamento.
    if (!device) return ws.close(CLOSE_UNPAIRED, "unpaired");
    hub.connect(ws, device);
  });
});

server.listen(config.port, "0.0.0.0", async () => {
  console.log(`\n✅ IDLE SYNC ${config.version} attivo su ${baseUrl()} · motore: ${engine.name}`);
  const paired = pairing.list();
  if (paired.length) console.log(`   Dispositivi abbinati: ${paired.map((d) => d.name).join(", ")}`);
  if (!paired.length) await hub.newPairingCode();
  else console.log("   Per abbinarne un altro: scrivi «p» e premi Invio, oppure usa Opzioni › Abbina un dispositivo.\n");
});

// «p» + Invio nel terminale genera un nuovo codice.
if (process.stdin.isTTY) {
  readline.createInterface({ input: process.stdin }).on("line", (line) => {
    if (line.trim().toLowerCase() === "p") hub.newPairingCode();
  });
}
