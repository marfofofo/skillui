// Il centro di IDLE SYNC: tiene sincronizzati tutti i dispositivi abbinati.
// Conversazione, conferme, impostazioni, cronologia e stato del Mac passano da qui.

import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { config } from "./config.js";
import { describeError, isAbort } from "./engines/index.js";
import { readMacStatus, runControl } from "./mac.js";
import { jsonFile } from "./store.js";
import { baseUrl } from "./web.js";

const STATUS_INTERVAL = 15_000;
const HISTORY_LIMIT = 100;
const HISTORY_ON_CONNECT = 50;
const EFFORTS = ["low", "medium", "high"];
const ICONS = ["play", "viewfinder", "moon", "laptop", "sparkles", "globe", "bulb", "mail", "speaker", "terminal"];

const DEFAULT_SETTINGS = {
  effort: config.effort,
  autoApprove: config.autoApprove,
  instructions: "",
  quickActions: [
    { id: "music", label: "Musica rilassante", icon: "play", prompt: "Metti un po' di musica rilassante su Spotify." },
    { id: "screen", label: "Cosa c'è sullo schermo?", icon: "viewfinder", prompt: "Guarda lo schermo e dimmi in breve cosa c'è." },
    { id: "focus", label: "Concentrazione", icon: "moon", prompt: "Chiudi le app di chat e social e abbassa il volume al 20." },
    { id: "mac", label: "Com'è messo il Mac?", icon: "laptop", prompt: "Dimmi in breve come sta il Mac: batteria, app aperta e volume." },
  ],
};

// Close code usato quando un dispositivo non è (più) abbinato: il client mostra la schermata di abbinamento.
export const CLOSE_UNPAIRED = 4001;

function sanitizeSettings(current, patch) {
  const next = { ...current };
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

export class Hub {
  constructor({ engine, pairing }) {
    this.engine = engine;
    this.pairing = pairing;
    this.clients = new Set(); // { id, deviceId, ws }
    this.approvals = new Map(); // id -> resolve
    this.settingsFile = jsonFile("settings.json", {});
    this.historyFile = jsonFile("history.json", []);
    this.settings = { ...DEFAULT_SETTINGS, ...this.settingsFile.get() };
    this.mac = null;
    this.statusTimer = null;
    this.onPairingCode = () => {};
  }

  // ------------------------------------------------------------------ connessioni

  connect(ws, device) {
    const client = { id: randomUUID(), deviceId: device.id, ws };
    this.clients.add(client);
    this.pairing.touch(device.id);
    this.updatePolling();

    this.send(client, {
      type: "hello",
      version: config.version,
      engine: this.engine.name,
      you: client.id,
      device: { id: device.id, name: device.name },
      host: config.host,
      busy: this.engine.busy,
      settings: this.settings,
      history: this.historyFile.get().slice(-HISTORY_ON_CONNECT),
      mac: this.mac,
    });
    this.broadcastDevices();
    console.log(`📱 ${device.name} connesso`);

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      this.handle(client, msg).catch((err) => this.send(client, { type: "toast", text: err.message }));
    });

    ws.on("close", () => {
      this.clients.delete(client);
      this.updatePolling();
      this.broadcastDevices();
      // Senza dispositivi nessuno può approvare: le richieste in sospeso vengono rifiutate.
      if (this.clients.size === 0) this.rejectApprovals();
    });
  }

  send(client, msg) {
    if (client.ws.readyState === 1) client.ws.send(JSON.stringify(msg));
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const c of this.clients) if (c.ws.readyState === 1) c.ws.send(data);
  }

  broadcastDevices() {
    const online = new Set([...this.clients].map((c) => c.deviceId));
    this.broadcast({ type: "devices", devices: this.pairing.list().map((d) => ({ ...d, online: online.has(d.id) })) });
  }

  disconnectDevice(deviceId) {
    for (const c of this.clients) if (c.deviceId === deviceId) c.ws.close(CLOSE_UNPAIRED, "unpaired");
  }

  // ------------------------------------------------------------------ messaggi

  async handle(client, msg) {
    switch (msg.type) {
      case "command":
        if (typeof msg.text === "string" && msg.text.trim()) this.runCommand(msg.text.trim().slice(0, 4000), client);
        break;
      case "approval":
        this.resolveApproval(msg.id, msg.ok === true);
        break;
      case "cancel":
        this.engine.cancel();
        this.rejectApprovals();
        break;
      case "reset":
        this.engine.reset();
        this.rejectApprovals();
        this.broadcast({ type: "reset" });
        break;
      case "settings":
        this.settings = sanitizeSettings(this.settings, msg.patch || {});
        this.settingsFile.set(this.settings);
        this.broadcast({ type: "settings", settings: this.settings });
        break;
      case "history:clear":
        this.historyFile.set([]);
        this.broadcast({ type: "history:clear" });
        break;
      case "control":
        await runControl(String(msg.action), msg.value).catch((err) => this.send(client, { type: "toast", text: err.message }));
        await this.refreshStatus();
        break;
      case "device:rename":
        this.pairing.rename(client.deviceId, msg.name);
        this.broadcastDevices();
        break;
      case "device:revoke":
        if (this.pairing.revoke(String(msg.id))) {
          this.disconnectDevice(String(msg.id));
          this.broadcastDevices();
        }
        break;
      case "pair:new":
        this.send(client, { type: "pair:code", ...(await this.newPairingCode()) });
        break;
      case "ping":
        this.send(client, { type: "pong" });
        break;
    }
  }

  async newPairingCode() {
    const { code, expiresAt } = this.pairing.newCode();
    const url = `${baseUrl()}/#code=${code}`;
    const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#000000", light: "#ffffff" } });
    this.onPairingCode({ code, url, expiresAt });
    return { code, url, expiresAt, qr };
  }

  // ------------------------------------------------------------------ conversazione

  async runCommand(text, origin) {
    if (this.engine.busy) {
      this.send(origin, { type: "toast", text: "Sto ancora lavorando al comando precedente." });
      return;
    }
    const device = this.pairing.devices.find((d) => d.id === origin.deviceId);
    const exchange = { id: randomUUID(), ts: Date.now(), device: device?.name ?? "", user: text, reply: "", tools: [] };
    console.log(`🎙️  [${exchange.device}] ${text}`);
    this.broadcast({ type: "command", id: exchange.id, text, origin: origin.id, device: exchange.device });
    this.broadcast({ type: "busy", busy: true });

    const io = {
      step: () => this.broadcast({ type: "step" }),
      delta: (t) => this.broadcast({ type: "delta", text: t }),
      status: (t) => this.broadcast({ type: "status", text: t }),
      tool: (name, detail) => {
        exchange.tools.push(name);
        this.broadcast({ type: "tool", name, detail });
      },
      approve: (name, detail) => this.requestApproval(name, detail),
    };

    try {
      exchange.reply = await this.engine.run(text, io, this.settings);
      console.log(`🤖 ${exchange.reply}`);
      this.broadcast({ type: "reply", text: exchange.reply, origin: origin.id });
    } catch (err) {
      const aborted = isAbort(err);
      exchange.reply = aborted ? "Comando annullato." : describeError(this.engine, err);
      if (!aborted) console.error("Errore del motore:", err.message);
      this.broadcast({ type: aborted ? "reply" : "error", text: exchange.reply, origin: origin.id });
    } finally {
      this.rejectApprovals();
      this.broadcast({ type: "busy", busy: false });
      this.addHistory(exchange);
      this.refreshStatus();
    }
  }

  requestApproval(name, detail) {
    return new Promise((resolve) => {
      if (this.clients.size === 0) return resolve(false);
      const id = randomUUID();
      this.approvals.set(id, resolve);
      this.broadcast({ type: "approval", id, name, detail });
    });
  }

  resolveApproval(id, ok) {
    const resolve = this.approvals.get(id);
    if (!resolve) return;
    this.approvals.delete(id);
    resolve(ok);
    this.broadcast({ type: "approval:done", id, ok });
  }

  rejectApprovals() {
    for (const id of [...this.approvals.keys()]) this.resolveApproval(id, false);
  }

  addHistory(entry) {
    const history = [...this.historyFile.get(), entry].slice(-HISTORY_LIMIT);
    this.historyFile.set(history);
    this.broadcast({ type: "history:add", entry });
  }

  // ------------------------------------------------------------------ stato del Mac

  async refreshStatus() {
    try {
      const next = await readMacStatus();
      if (JSON.stringify(next) !== JSON.stringify(this.mac)) {
        this.mac = next;
        this.broadcast({ type: "mac", status: this.mac });
      }
    } catch (err) {
      console.error("Stato del Mac non disponibile:", err.message);
    }
  }

  updatePolling() {
    if (this.clients.size > 0 && !this.statusTimer) {
      this.refreshStatus();
      this.statusTimer = setInterval(() => this.refreshStatus(), STATUS_INTERVAL);
    } else if (this.clients.size === 0 && this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }
}
