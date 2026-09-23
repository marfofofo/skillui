// Stato del Mac per i widget e controlli diretti: nessuna chiamata al modello,
// quindi sono istantanei e gratuiti.

import { config } from "./config.js";
import { osascript, run } from "./system.js";

async function isRunning(processName) {
  const res = await run("pgrep", ["-x", processName]).catch(() => ({ code: 1 }));
  return res.code === 0;
}

async function nowPlaying() {
  // Si interroga un'app solo se è già aperta, così non viene avviata per sbaglio.
  for (const app of ["Spotify", "Music"]) {
    if (!(await isRunning(app))) continue;
    try {
      const out = await osascript([
        `tell application "${app}"`,
        'if player state is stopped then return ""',
        "set sep to character id 31",
        "return (player state as text) & sep & (name of current track) & sep & (artist of current track)",
        "end tell",
      ]);
      if (!out) continue;
      const [state, title, artist] = out.split("\u001f");
      return { app, playing: state === "playing", title, artist };
    } catch {
      // App aperta ma senza brano, o permesso di Automazione negato.
    }
  }
  return null;
}

async function frontApp() {
  const asn = (await run("lsappinfo", ["front"])).stdout;
  if (!asn) return null;
  const info = (await run("lsappinfo", ["info", "-only", "name", asn])).stdout;
  return info.match(/"([^"]+)"\s*$/)?.[1] ?? null;
}

async function volume() {
  const out = await osascript(["get volume settings"]);
  const level = Number(out.match(/output volume:(\d+)/)?.[1]);
  return { level: Number.isFinite(level) ? level : null, muted: /output muted:true/.test(out) };
}

async function battery() {
  const out = (await run("pmset", ["-g", "batt"])).stdout;
  const m = out.match(/(\d+)%;\s*([a-zA-Z ]+)/);
  if (!m) return null; // Mac senza batteria
  return { percent: Number(m[1]), charging: /^(charging|charged|AC attached|finishing charge)/i.test(m[2].trim()) };
}

const DEMO_STATUS = {
  app: "Safari",
  volume: { level: 42, muted: false },
  battery: { percent: 78, charging: false },
  nowPlaying: { app: "Spotify", playing: true, title: "Weightless", artist: "Marconi Union" },
};

export async function readMacStatus() {
  if (config.demo) return structuredClone(DEMO_STATUS);
  if (process.platform !== "darwin") return null;
  const safe = (p) => p.catch(() => null);
  const [app, vol, batt, playing] = await Promise.all([safe(frontApp()), safe(volume()), safe(battery()), safe(nowPlaying())]);
  return { app, volume: vol, battery: batt, nowPlaying: playing };
}

// Comandi immediati dai widget: nessuna chiamata al modello.
export async function runControl(action, value) {
  if (config.demo) {
    const s = DEMO_STATUS;
    if (action === "playpause" && s.nowPlaying) s.nowPlaying.playing = !s.nowPlaying.playing;
    if (action === "volume") s.volume.level = Math.max(0, Math.min(100, Math.round(value)));
    if (action === "mute") s.volume.muted = !s.volume.muted;
    return;
  }
  if (process.platform !== "darwin") throw new Error("Controlli disponibili solo su macOS");
  switch (action) {
    case "playpause":
    case "next":
    case "previous": {
      const current = await nowPlaying();
      const app = current?.app ?? ((await isRunning("Music")) && !(await isRunning("Spotify")) ? "Music" : "Spotify");
      const cmd = { playpause: "playpause", next: "next track", previous: "previous track" }[action];
      await osascript([`tell application "${app}" to ${cmd}`]);
      return;
    }
    case "volume": {
      const level = Math.max(0, Math.min(100, Math.round(Number(value))));
      if (!Number.isFinite(level)) throw new Error("Volume non valido");
      await osascript([`set volume output volume ${level}`, "set volume without output muted"]);
      return;
    }
    case "mute": {
      const { muted } = await volume();
      await osascript([muted ? "set volume without output muted" : "set volume with output muted"]);
      return;
    }
    case "sleep_display":
      await run("pmset", ["displaysleepnow"]);
      return;
    default:
      throw new Error(`Controllo sconosciuto: ${action}`);
  }
}
