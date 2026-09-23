// IDLE SYNC — web app per iPhone, iPad e browser.
// Microfono → testo → Mac; la risposta arriva in streaming e viene letta ad alta voce.
// Tutti i dispositivi abbinati condividono conversazione, cronologia e impostazioni.

import { createApprovalSheet } from "./approval.js";
import { createConnection } from "./connection.js";
import { QA_ICONS, TOOLS, esc, svg } from "./icons.js";
import { createOrb } from "./orb.js";
import { forgetToken, readToken, showPairing } from "./pairing.js";
import { $, paintRange, store, toast } from "./util.js";
import { canListen, createSpeaker, listen } from "./voice.js";

const body = document.body;
const card = $("card");
const heard = $("heard");
const reply = $("reply");
const steps = $("steps");

// ---------------------------------------------------------------------------
// Stato

const state = {
  connected: false,
  busy: false,
  listening: false,
  me: null, // id di questa connessione
  deviceId: null, // id di questo dispositivo abbinato
  host: "",
  settings: { effort: "low", autoApprove: false, instructions: "", quickActions: [] },
  devices: [],
  mac: null,
  exchangeOrigin: null,
  streamText: "",
};

let conn = null;
const orb = createOrb($("orb"), document.documentElement.dataset.theme === "light" ? "light" : "dark");
const speaker = createSpeaker({ onChange: () => render() });
const approval = createApprovalSheet({
  onAnswer: (id, ok) => {
    send({ type: "approval", id, ok });
    render();
  },
});

const CAPTIONS = {
  offline: "Mac non raggiungibile",
  idle: "Tocca per parlare",
  listening: "Ti ascolto…",
  thinking: "Tocca per interrompere",
  speaking: "Tocca per zittire",
  approval: "In attesa di conferma",
};

function currentState() {
  if (!state.connected) return "offline";
  if (approval.pendingId) return "approval";
  if (state.listening) return "listening";
  if (state.busy) return "thinking";
  if (speaker.speaking) return "speaking";
  return "idle";
}

function render() {
  const s = currentState();
  body.dataset.state = s;
  $("caption").textContent = CAPTIONS[s];
  $("orbBtn").setAttribute("aria-label", CAPTIONS[s]);
  orb.setState(s);
}

function send(msg) {
  if (conn?.send(msg)) return true;
  toast("Il Mac non è raggiungibile.");
  return false;
}

// ---------------------------------------------------------------------------
// Card della conversazione

function showCard() {
  card.hidden = false;
  body.classList.add("has-card");
}

function hideCard() {
  card.hidden = true;
  body.classList.remove("has-card");
}

function setReply(text, { pending = false, animate = true } = {}) {
  reply.classList.toggle("pending", pending);
  if (animate) {
    reply.classList.remove("enter");
    void reply.offsetWidth; // riavvia l'animazione
    reply.classList.add("enter");
  }
  reply.textContent = text;
}

function settleSteps() {
  for (const s of steps.querySelectorAll(".step-state.spin")) {
    s.classList.remove("spin");
    s.innerHTML = svg("check");
  }
}

function addStep(name, detail, { error = false } = {}) {
  settleSteps();
  const meta = TOOLS[name] || { icon: "info", title: () => name.replace(/_/g, " ") };
  const first = (detail || "").split("\n")[0].trim();
  const li = document.createElement("li");
  if (error) li.className = "err";
  li.innerHTML = `
    <span class="tile">${svg(error ? "warn" : meta.icon)}</span>
    <span class="step-text"><span class="step-title"></span><span class="step-detail"></span></span>
    <span class="step-state${error ? "" : " spin"}"></span>`;
  li.querySelector(".step-title").textContent = error ? "Errore" : meta.title(first.length > 40 ? `${first.slice(0, 40)}…` : first);
  if ((meta.detail || error) && first) li.querySelector(".step-detail").textContent = first;
  steps.appendChild(li);
  while (steps.children.length > 5) steps.firstChild.remove();
  card.scrollTop = card.scrollHeight;
}

function clearConversation() {
  heard.textContent = "";
  steps.innerHTML = "";
  reply.textContent = "";
  hideCard();
}

$("cardClose").onclick = () => !state.busy && hideCard();

// ---------------------------------------------------------------------------
// Cronologia (condivisa, salvata sul Mac)

const log = $("log");
const timeFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", hour: "2-digit", minute: "2-digit" });
const toolLabel = (n) => (TOOLS[n] ? TOOLS[n].title("").replace(/\s*«?»?$/, "") : n);

function historyItem(entry) {
  const li = document.createElement("li");
  li.innerHTML = `
    <p class="meta">${esc(timeFmt.format(entry.ts))} · ${esc(entry.device || "")}</p>
    <p class="u">${esc(entry.user || "")}</p>
    <p class="a">${esc(entry.reply || "")}</p>`;
  const tools = [...new Set((entry.tools || []).map(toolLabel))];
  if (tools.length) li.insertAdjacentHTML("beforeend", `<p class="meta tools">${esc(tools.join(" · "))}</p>`);
  return li;
}

function renderHistory(entries) {
  log.innerHTML = entries.length ? "" : '<li class="empty">Nessuna richiesta</li>';
  for (const e of [...entries].reverse()) log.appendChild(historyItem(e));
}

function prependHistory(entry) {
  log.querySelector(".empty")?.remove();
  log.prepend(historyItem(entry));
  while (log.children.length > 100) log.lastChild.remove();
}

// ---------------------------------------------------------------------------
// Widget del Mac

const volSlider = $("volSlider");
let volDragging = false;
let volTimer = null;

function renderMac() {
  const mac = state.mac;
  $("widgets").hidden = !mac;
  if (!mac) return;

  const np = mac.nowPlaying;
  $("wPlaying").hidden = !np;
  $("wApp").hidden = Boolean(np) || !mac.app;
  if (np) {
    $("wPlaying").classList.toggle("playing", np.playing);
    $("npApp").textContent = np.app === "Music" ? "Musica" : np.app;
    $("npTitle").textContent = np.title || "";
    $("npArtist").textContent = np.artist || "";
  }
  if (mac.app) $("appName").textContent = mac.app;

  const b = mac.battery;
  $("wBattery").hidden = !b;
  if (b) {
    $("battText").textContent = `${b.percent}%${b.charging ? " ⚡︎" : ""}`;
    $("battRing").style.strokeDashoffset = String(113.1 * (1 - b.percent / 100));
    $("wBattery").classList.toggle("low", b.percent <= 20 && !b.charging);
  }

  const v = mac.volume;
  $("wVolume").hidden = !v || v.level == null;
  if (v && v.level != null) {
    $("wVolume").classList.toggle("muted", v.muted);
    if (!volDragging) {
      volSlider.value = String(v.level);
      paintRange(volSlider);
    }
  }
}

volSlider.addEventListener("input", () => {
  volDragging = true;
  paintRange(volSlider);
  clearTimeout(volTimer);
  volTimer = setTimeout(() => send({ type: "control", action: "volume", value: Number(volSlider.value) }), 120);
});
volSlider.addEventListener("change", () => {
  send({ type: "control", action: "volume", value: Number(volSlider.value) });
  setTimeout(() => (volDragging = false), 800);
});
$("muteBtn").onclick = () => send({ type: "control", action: "mute" });
for (const b of document.querySelectorAll("[data-control]")) {
  b.onclick = () => {
    if (b.dataset.control === "playpause" && state.mac?.nowPlaying) {
      state.mac.nowPlaying.playing = !state.mac.nowPlaying.playing; // risposta immediata, poi conferma dal Mac
      renderMac();
    }
    send({ type: "control", action: b.dataset.control });
  };
}

// ---------------------------------------------------------------------------
// Azioni rapide e comandi

function renderQuick() {
  const q = $("quick");
  q.innerHTML = "";
  for (const a of state.settings.quickActions) {
    const b = document.createElement("button");
    b.className = "chip material";
    b.setAttribute("role", "listitem");
    b.innerHTML = `${svg(a.icon)}<span></span>`;
    b.querySelector("span").textContent = a.label;
    b.onclick = () => {
      speaker.unlock();
      sendCommand(a.prompt);
    };
    q.appendChild(b);
  }
}

function sendCommand(text) {
  text = text.trim();
  if (!text) return;
  if (state.busy) return toast("Sto ancora lavorando al comando precedente.");
  send({ type: "command", text });
}

// ---------------------------------------------------------------------------
// Messaggi dal Mac

function handle(msg) {
  switch (msg.type) {
    case "hello":
      state.me = msg.you;
      state.deviceId = msg.device.id;
      state.host = msg.host;
      state.busy = msg.busy;
      state.settings = msg.settings;
      state.mac = msg.mac;
      store.set("device", msg.device.name);
      $("host").textContent = msg.host;
      $("deviceName").value = msg.device.name;
      $("heroSub").textContent = `Versione ${msg.version} · ${msg.engine} · ${msg.host}`;
      renderSettings();
      renderQuick();
      renderMac();
      renderHistory(msg.history || []);
      render();
      break;
    case "devices":
      state.devices = msg.devices;
      renderDevices();
      break;
    case "settings":
      state.settings = msg.settings;
      renderSettings();
      renderQuick();
      break;
    case "mac":
      state.mac = msg.status;
      renderMac();
      break;
    case "busy":
      state.busy = msg.busy;
      if (!state.busy) settleSteps();
      render();
      break;
    case "command":
      state.exchangeOrigin = msg.origin;
      state.streamText = "";
      showCard();
      heard.textContent = msg.origin === state.me ? msg.text : `${msg.device}: ${msg.text}`;
      steps.innerHTML = "";
      setReply("Un attimo…", { pending: true });
      break;
    case "step":
      state.streamText = "";
      break;
    case "delta":
      showCard();
      state.streamText += msg.text;
      setReply(state.streamText, { animate: false });
      break;
    case "status":
      if (!state.streamText) setReply(msg.text, { pending: true });
      break;
    case "tool":
      showCard();
      addStep(msg.name, msg.detail);
      break;
    case "approval":
      approval.open(msg);
      closeMenu();
      if (state.exchangeOrigin === state.me) speaker.speak("Serve la tua conferma.");
      render();
      break;
    case "approval:done":
      if (approval.pendingId === msg.id) {
        approval.close();
        render();
      }
      break;
    case "reply":
    case "error":
      showCard();
      settleSteps();
      if (msg.type === "error") addStep("error", msg.text, { error: true });
      setReply(msg.text, { animate: !state.streamText || msg.type === "error" });
      state.streamText = "";
      state.exchangeOrigin = null;
      // La voce risponde solo sul dispositivo che ha fatto la domanda.
      if (msg.origin === state.me) speaker.speak(msg.text);
      break;
    case "history:add":
      prependHistory(msg.entry);
      break;
    case "history:clear":
      renderHistory([]);
      break;
    case "reset":
      clearConversation();
      break;
    case "pair:code":
      showPairCode(msg);
      break;
    case "toast":
      toast(msg.text);
      break;
  }
}

// ---------------------------------------------------------------------------
// Sfera, microfono e campo di testo

let recognition = null;

$("orbBtn").onclick = () => {
  speaker.unlock();
  switch (currentState()) {
    case "listening":
      recognition?.stop();
      break;
    case "thinking":
      send({ type: "cancel" });
      break;
    case "speaking":
      speaker.stop();
      render();
      break;
    case "idle":
      startListening();
      break;
  }
};

function startListening() {
  if (!canListen) return $("text").focus(); // la tastiera di iOS ha il tasto microfono per dettare
  speaker.stop();
  try {
    recognition = listen({
      onText: (text) => {
        showCard();
        heard.textContent = "";
        steps.innerHTML = "";
        setReply(text, { pending: true, animate: false });
        orb.kick();
      },
      onDone: (text) => {
        state.listening = false;
        render();
        if (text) sendCommand(text);
        else if (!state.busy && !reply.textContent.trim()) hideCard();
      },
      onError: toast,
    });
    state.listening = true;
  } catch {
    state.listening = false;
  }
  render();
}

const field = $("form");
const input = $("text");
input.addEventListener("input", () => field.classList.toggle("ready", input.value.trim().length > 0));
field.onsubmit = (e) => {
  e.preventDefault();
  speaker.unlock();
  sendCommand(input.value);
  input.value = "";
  field.classList.remove("ready");
  input.blur();
};

// ---------------------------------------------------------------------------
// Menu "…" e pagine

const menu = $("menu");
const menuBtn = $("menuBtn");

function closeMenu() {
  menu.hidden = true;
  $("menuScrim").hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
}

menuBtn.onclick = () => {
  const open = menu.hidden;
  menu.hidden = !open;
  $("menuScrim").hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
};
$("menuScrim").onclick = closeMenu;
$("historyBtn").onclick = () => {
  closeMenu();
  $("history").hidden = false;
};
$("optionsBtn").onclick = () => {
  closeMenu();
  renderSettings();
  $("options").hidden = false;
};
for (const b of document.querySelectorAll("[data-close]")) b.onclick = () => ($(b.dataset.close).hidden = true);
$("reset").onclick = () => {
  closeMenu();
  speaker.stop();
  send({ type: "reset" });
};

// ---------------------------------------------------------------------------
// Opzioni: impostazioni condivise

function setSegmented(seg, value) {
  [...seg.querySelectorAll("button")].forEach((b, i) => {
    const on = b.dataset.value === value;
    b.setAttribute("aria-checked", String(on));
    if (on) seg.querySelector(".seg-thumb").style.transform = `translateX(${i * 100}%)`;
  });
}

function pushSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  send({ type: "settings", patch: state.settings });
}

function renderSettings() {
  setSegmented($("effortSeg"), state.settings.effort);
  if (document.activeElement !== $("instructions")) $("instructions").value = state.settings.instructions || "";
  $("confirmSwitch").checked = !state.settings.autoApprove;
  renderQaList();
}

for (const b of $("effortSeg").querySelectorAll("button")) {
  b.onclick = () => {
    setSegmented($("effortSeg"), b.dataset.value);
    pushSettings({ effort: b.dataset.value });
  };
}

let instrTimer = null;
$("instructions").addEventListener("input", () => {
  clearTimeout(instrTimer);
  instrTimer = setTimeout(() => pushSettings({ instructions: $("instructions").value }), 700);
});

$("confirmSwitch").onchange = () => {
  const sw = $("confirmSwitch");
  if (!sw.checked && !confirm("Senza conferma, IDLE SYNC potrà eseguire comandi del Terminale da solo. Continuare?")) {
    sw.checked = true;
    return;
  }
  pushSettings({ autoApprove: !sw.checked });
};

$("clearHistory").onclick = () => {
  if (confirm("Cancellare la cronologia su tutti i dispositivi?")) send({ type: "history:clear" });
};

// Azioni rapide
function renderQaList() {
  const list = $("qaList");
  list.innerHTML = "";
  state.settings.quickActions.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "cell";
    row.innerHTML = `
      <button class="qa-del" aria-label="Elimina">${svg("minus")}</button>
      <span class="tile">${svg(a.icon)}</span>
      <span class="qa-text"><span class="qa-label"></span><span class="qa-prompt"></span></span>`;
    row.querySelector(".qa-label").textContent = a.label;
    row.querySelector(".qa-prompt").textContent = a.prompt;
    row.querySelector(".qa-del").onclick = () => {
      pushSettings({ quickActions: state.settings.quickActions.filter((_, j) => j !== i) });
      renderQaList();
      renderQuick();
    };
    list.appendChild(row);
  });
}

let qaIcon = "sparkles";
const qaForm = $("qaForm");
const qaIcons = $("qaIcons");
const markIcon = () => qaIcons.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.icon === qaIcon)));

for (const name of QA_ICONS) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.icon = name;
  b.setAttribute("role", "radio");
  b.setAttribute("aria-label", name);
  b.innerHTML = svg(name);
  b.onclick = () => {
    qaIcon = name;
    markIcon();
  };
  qaIcons.appendChild(b);
}

function closeQaForm() {
  qaForm.hidden = true;
  $("qaAdd").hidden = false;
  qaForm.reset();
}

$("qaAdd").onclick = () => {
  qaForm.hidden = false;
  $("qaAdd").hidden = true;
  qaIcon = "sparkles";
  markIcon();
  $("qaLabel").focus();
};
$("qaCancel").onclick = closeQaForm;
qaForm.onsubmit = (e) => {
  e.preventDefault();
  const label = $("qaLabel").value.trim();
  const prompt = $("qaPrompt").value.trim();
  if (!label || !prompt) return;
  pushSettings({ quickActions: [...state.settings.quickActions, { id: `qa-${Date.now()}`, label, prompt, icon: qaIcon }] });
  closeQaForm();
  renderQaList();
  renderQuick();
};

// ---------------------------------------------------------------------------
// Opzioni: dispositivi e abbinamento

function renderDevices() {
  const online = state.devices.filter((d) => d.online).length;
  $("deviceCount").hidden = online < 2;
  $("deviceCount").textContent = `· ${online} dispositivi`;

  const list = $("deviceList");
  list.innerHTML = "";
  for (const d of state.devices) {
    const row = document.createElement("div");
    row.className = "cell";
    const icon = /iPad/i.test(d.name) ? "tablet" : /Mac|Browser/i.test(d.name) ? "laptop" : "phone";
    const self = d.id === state.deviceId;
    row.innerHTML = `
      <span class="dev-icon">${svg(icon)}</span>
      <span class="dev-text"><span class="dev-name"></span><span class="dev-sub"></span></span>
      ${self ? '<span class="tag">Questo</span>' : '<button class="text-btn danger">Rimuovi</button>'}`;
    row.querySelector(".dev-name").textContent = d.name;
    row.querySelector(".dev-sub").innerHTML = d.online ? '<span class="live-dot"></span>Collegato' : `Visto ${esc(timeFmt.format(d.lastSeen))}`;
    row.querySelector(".danger")?.addEventListener("click", () => {
      if (confirm(`Rimuovere «${d.name}»? Dovrà essere abbinato di nuovo.`)) send({ type: "device:revoke", id: d.id });
    });
    list.appendChild(row);
  }
}

$("deviceName").addEventListener("change", () => {
  const name = $("deviceName").value.trim();
  if (name) send({ type: "device:rename", name });
});

$("unpairSelf").onclick = () => {
  if (confirm("Scollegare questo dispositivo? Per usarlo di nuovo servirà un codice di abbinamento.")) {
    send({ type: "device:revoke", id: state.deviceId });
  }
};

// Foglio con QR e codice per abbinare un nuovo dispositivo
let pairTimer = null;
$("pairNew").onclick = () => send({ type: "pair:new" });
$("pairSheetDone").onclick = closePairSheet;
$("pairSheetScrim").onclick = closePairSheet;

function showPairCode({ code, qr, url, expiresAt }) {
  $("pairQr").innerHTML = qr;
  $("pairCodeBig").textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
  $("pairUrl").textContent = url.replace(/#.*$/, "");
  $("pairSheet").hidden = false;
  $("pairSheetScrim").hidden = false;
  clearInterval(pairTimer);
  const tick = () => {
    const left = Math.max(0, (expiresAt ?? Date.now()) - Date.now());
    const m = Math.floor(left / 60000);
    const s = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
    $("pairExpiry").textContent = expiresAt ? (left > 0 ? `Scade tra ${m}:${s}` : "Codice scaduto") : "";
  };
  tick();
  pairTimer = setInterval(tick, 1000);
}

function closePairSheet() {
  clearInterval(pairTimer);
  $("pairSheet").hidden = true;
  $("pairSheetScrim").hidden = true;
}

// ---------------------------------------------------------------------------
// Opzioni: voce (preferenze di questo dispositivo)

const speakSwitch = $("speakSwitch");
const voiceSelect = $("voiceSelect");
const rateSlider = $("rateSlider");
speakSwitch.checked = speaker.prefs.enabled;
rateSlider.value = String(speaker.prefs.rate);
paintRange(rateSlider);

function renderVoices() {
  const voices = speaker.voices();
  voiceSelect.innerHTML = '<option value="">Automatica</option>';
  for (const v of voices) voiceSelect.add(new Option(v.name, v.voiceURI));
  voiceSelect.value = voices.some((v) => v.voiceURI === speaker.prefs.voice) ? speaker.prefs.voice : "";
}
renderVoices();
speaker.onVoicesChanged(renderVoices);

speakSwitch.onchange = () => speaker.save({ enabled: speakSwitch.checked });
voiceSelect.onchange = () => {
  speaker.save({ voice: voiceSelect.value });
  speaker.unlock();
  speaker.speak("Ciao, questa è la mia voce.");
};
rateSlider.addEventListener("input", () => paintRange(rateSlider));
rateSlider.addEventListener("change", () => {
  speaker.save({ rate: Number(rateSlider.value) });
  speaker.unlock();
  speaker.speak("Ciao, questa è la mia velocità.");
});

// ---------------------------------------------------------------------------
// Tema: automatico (segue il dispositivo), chiaro o scuro

const systemLight = matchMedia("(prefers-color-scheme: light)");
let themePref = store.get("theme") || "auto";

function applyTheme() {
  const resolved = themePref === "auto" ? (systemLight.matches ? "light" : "dark") : themePref;
  document.documentElement.dataset.theme = resolved;
  $("themeColor").setAttribute("content", resolved === "light" ? "#f5f5f5" : "#000000");
  setSegmented($("themeSeg"), themePref);
  orb.setTheme(resolved);
}

for (const b of $("themeSeg").querySelectorAll("button")) {
  b.onclick = () => {
    themePref = b.dataset.value;
    store.set("theme", themePref);
    applyTheme();
  };
}
systemLight.addEventListener("change", applyTheme);
applyTheme();

// ---------------------------------------------------------------------------
// Avvio: abbinamento, connessione, schermo sempre acceso

function start(token) {
  conn = createConnection({
    token,
    onMessage: handle,
    onOpen: () => {
      state.connected = true;
      render();
    },
    onClose: () => {
      state.connected = false;
      state.busy = false;
      $("host").textContent = "Non connesso";
      $("deviceCount").hidden = true;
      approval.close();
      render();
    },
    onUnpaired: () => {
      state.connected = false;
      forgetToken();
      clearConversation();
      render();
      for (const id of ["options", "history"]) $(id).hidden = true;
      showPairing(start);
    },
  });
}

async function keepAwake() {
  try {
    if ("wakeLock" in navigator && document.visibilityState === "visible") await navigator.wakeLock.request("screen");
  } catch {}
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  keepAwake();
  conn?.connect();
});
document.addEventListener("click", keepAwake, { once: true });

render();
const token = readToken();
if (token) start(token);
else showPairing(start);
