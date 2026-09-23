// Abbinamento dei dispositivi.
//
// - Il Mac mostra un codice a 6 cifre (e un QR che lo contiene). È monouso e,
//   una volta abbinato il primo dispositivo, scade dopo 10 minuti.
// - Chi inserisce il codice giusto riceve un token personale; sul Mac se ne salva
//   solo l'impronta SHA-256, quindi il file dei dispositivi non contiene segreti.
// - Troppi tentativi sbagliati bloccano quell'indirizzo per qualche minuto e,
//   oltre una soglia, il codice viene rigenerato.

import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { jsonFile } from "./store.js";

const CODE_TTL = 10 * 60_000;
const MAX_FAILURES_PER_IP = 5;
const LOCKOUT = 5 * 60_000;
const MAX_FAILURES_PER_CODE = 20;

const hash = (token) => createHash("sha256").update(token).digest("hex");

export class PairingError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export class Pairing {
  constructor() {
    this.store = jsonFile("devices.json", []);
    this.code = null;
    this.codeExpires = 0;
    this.codeFailures = 0;
    this.ipFailures = new Map(); // ip -> { count, until }
  }

  get devices() {
    return this.store.get();
  }

  // Il primo codice non scade: all'installazione non c'è ancora nessuno che possa generarne un altro.
  get codeIsValid() {
    return this.code !== null && (this.devices.length === 0 || Date.now() < this.codeExpires);
  }

  newCode() {
    this.code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    this.codeExpires = Date.now() + CODE_TTL;
    this.codeFailures = 0;
    return this.currentCode();
  }

  currentCode() {
    if (!this.codeIsValid) return null;
    return { code: this.code, expiresAt: this.devices.length === 0 ? null : this.codeExpires };
  }

  pair(code, name, ip) {
    const lock = this.ipFailures.get(ip);
    if (lock && lock.until > Date.now()) {
      throw new PairingError("Troppi tentativi. Riprova tra qualche minuto.", 429);
    }
    if (!this.codeIsValid) {
      throw new PairingError("Nessun codice attivo: generane uno nuovo sul Mac o da un dispositivo abbinato.", 410);
    }
    if (String(code).trim() !== this.code) {
      this.recordFailure(ip);
      throw new PairingError("Codice non corretto.", 401);
    }

    this.ipFailures.delete(ip);
    this.code = null; // monouso
    const token = randomBytes(32).toString("base64url");
    const device = {
      id: randomUUID(),
      name: cleanName(name),
      tokenHash: hash(token),
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    this.store.set([...this.devices, device]);
    return { token, device: publicDevice(device) };
  }

  recordFailure(ip) {
    const entry = this.ipFailures.get(ip) ?? { count: 0, until: 0 };
    entry.count += 1;
    if (entry.count >= MAX_FAILURES_PER_IP) {
      entry.count = 0;
      entry.until = Date.now() + LOCKOUT;
    }
    this.ipFailures.set(ip, entry);
    if (++this.codeFailures >= MAX_FAILURES_PER_CODE) this.newCode();
  }

  verify(token) {
    if (typeof token !== "string" || token.length < 20) return null;
    const h = hash(token);
    return this.devices.find((d) => d.tokenHash === h) ?? null;
  }

  update(id, patch) {
    this.store.set(this.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  touch(id) {
    this.update(id, { lastSeen: Date.now() });
  }

  rename(id, name) {
    this.update(id, { name: cleanName(name) });
  }

  revoke(id) {
    const before = this.devices.length;
    this.store.set(this.devices.filter((d) => d.id !== id));
    return this.devices.length < before;
  }

  list() {
    return this.devices.map(publicDevice);
  }
}

function cleanName(name) {
  return String(name || "Dispositivo").trim().slice(0, 40) || "Dispositivo";
}

function publicDevice({ id, name, createdAt, lastSeen }) {
  return { id, name, createdAt, lastSeen };
}
