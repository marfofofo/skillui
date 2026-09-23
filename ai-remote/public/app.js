// AI Remote — web app per l'iPhone.
// Microfono → testo → Mac; la risposta torna sul display e viene letta ad alta voce.

(() => {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const stateLabel = $("stateLabel");
  const heard = $("heard");
  const reply = $("reply");
  const ticker = $("ticker");
  const orbBtn = $("orbBtn");
  const orbHint = $("orbHint");
  const input = $("text");
  const hostLabel = $("host");
  const speakToggle = $("speakToggle");
  const log = $("log");

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const params = new URLSearchParams(location.search);
  const token = params.get("t") || store.get("token");
  if (params.get("t")) store.set("token", params.get("t"));

  let ws = null;
  let connected = false;
  let busy = false;
  let listening = false;
  let speaking = false;
  let pendingApprovalId = null;
  let retryDelay = 1000;
  let speakEnabled = store.get("speak") !== "off";
  let exchange = null; // { user, reply, tools[] } in corso

  speakToggle.setAttribute("aria-pressed", String(speakEnabled));

  // ---------------------------------------------------------------------------
  // Stato del dispositivo

  const LABELS = {
    offline: ["Mac non raggiungibile", "—"],
    idle: ["Pronto", "PARLA"],
    listening: ["In ascolto", "FINE"],
    thinking: ["Sto lavorando", "STOP"],
    speaking: ["Rispondo", "ZITTO"],
    approval: ["Attendo conferma", "…"],
  };

  function currentState() {
    if (!connected) return "offline";
    if (pendingApprovalId) return "approval";
    if (listening) return "listening";
    if (busy) return "thinking";
    if (speaking) return "speaking";
    return "idle";
  }

  function render() {
    const s = currentState();
    body.dataset.state = s;
    stateLabel.textContent = LABELS[s][0];
    orbHint.textContent = LABELS[s][1];
    orb.setState(s);
  }

  function showReply(text, { accent = false, pending = false } = {}) {
    reply.classList.remove("enter");
    reply.classList.toggle("pending", pending);
    void reply.offsetWidth; // riavvia l'animazione
    reply.textContent = "";
    if (accent) {
      const em = document.createElement("em");
      em.textContent = text;
      reply.appendChild(em);
    } else {
      reply.textContent = text;
    }
    reply.classList.add("enter");
    reply.scrollTop = 0;
  }

  function addTick(label, detail, err = false) {
    const li = document.createElement("li");
    if (err) li.className = "err";
    const b = document.createElement("b");
    b.textContent = label;
    const span = document.createElement("span");
    span.textContent = detail || "";
    li.append(b, span);
    ticker.appendChild(li);
    while (ticker.children.length > 4) ticker.firstChild.remove();
  }

  function clearTicks() {
    ticker.innerHTML = "";
  }

  // ---------------------------------------------------------------------------
  // Cronologia

  function pushHistory(entry) {
    const li = document.createElement("li");
    if (entry.user) {
      const u = document.createElement("p");
      u.className = "u";
      u.textContent = entry.user;
      li.appendChild(u);
    }
    const a = document.createElement("p");
    a.className = "a";
    a.textContent = entry.reply;
    li.appendChild(a);
    if (entry.tools.length) {
      const t = document.createElement("p");
      t.className = "t";
      t.textContent = entry.tools.join(" · ");
      li.appendChild(t);
    }
    log.querySelector(".empty")?.remove();
    log.prepend(li);
    while (log.children.length > 60) log.lastChild.remove();
  }

  function resetHistoryView() {
    log.innerHTML = '<li class="empty">Nessun comando ancora.</li>';
  }
  resetHistoryView();

  $("historyBtn").onclick = () => ($("history").hidden = false);
  $("historyClose").onclick = () => ($("history").hidden = true);

  // ---------------------------------------------------------------------------
  // Connessione

  function connect() {
    if (!token) {
      hostLabel.textContent = "senza codice";
      showReply("Apri il link mostrato nel terminale del Mac.", { accent: true });
      return;
    }
    if (ws && ws.readyState <= WebSocket.OPEN) return;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${location.host}/ws?t=${encodeURIComponent(token)}`);
    ws = socket;

    socket.onopen = () => {
      retryDelay = 1000;
      connected = true;
      render();
    };
    socket.onclose = () => {
      if (ws !== socket) return;
      connected = false;
      busy = false;
      closeApproval();
      render();
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 15000);
    };
    socket.onmessage = (ev) => handle(JSON.parse(ev.data));
  }

  function sendMsg(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    addTick("errore", "non connesso al Mac", true);
    return false;
  }

  function handle(msg) {
    switch (msg.type) {
      case "hello":
        hostLabel.textContent = msg.host.replace(/\.local$/, "");
        busy = msg.busy;
        render();
        break;
      case "busy":
        busy = msg.busy;
        render();
        break;
      case "status":
        addTick("nota", msg.text);
        break;
      case "tool":
        addTick(msg.name.replace(/_/g, " "), msg.detail ? msg.detail.split("\n")[0] : "");
        exchange?.tools.push(msg.name);
        break;
      case "approval":
        openApproval(msg);
        break;
      case "reply":
        finishExchange(msg.text);
        break;
      case "error":
        addTick("errore", msg.text, true);
        finishExchange(msg.text);
        break;
    }
  }

  function sendCommand(text) {
    text = text.trim();
    if (!text) return;
    if (busy) {
      addTick("attendi", "sto ancora lavorando", true);
      return;
    }
    if (!sendMsg({ type: "command", text })) return;
    exchange = { user: text, reply: "", tools: [] };
    heard.textContent = text;
    clearTicks();
    showReply("Un attimo…", { pending: true });
    busy = true;
    render();
  }

  function finishExchange(text) {
    showReply(text);
    if (exchange) {
      exchange.reply = text;
      pushHistory(exchange);
      exchange = null;
    }
    speak(text);
  }

  // ---------------------------------------------------------------------------
  // Conferma a pressione prolungata

  const allow = $("allow");
  let holdTimer = null;

  function openApproval(msg) {
    pendingApprovalId = msg.id;
    $("approvalName").textContent = msg.name === "run_shell" ? "Comando nel terminale"
      : msg.name === "run_applescript" ? "Script AppleScript" : msg.name;
    $("approvalDetail").textContent = msg.detail || "";
    $("approval").hidden = false;
    speak("Serve la tua conferma.");
    render();
  }

  function closeApproval() {
    pendingApprovalId = null;
    $("approval").hidden = true;
    cancelHold();
  }

  function answerApproval(ok) {
    if (pendingApprovalId) {
      sendMsg({ type: "approval", id: pendingApprovalId, ok });
      addTick(ok ? "confermato" : "rifiutato", "", !ok);
    }
    closeApproval();
    render();
  }

  function startHold(e) {
    e.preventDefault();
    allow.classList.add("holding");
    holdTimer = setTimeout(() => answerApproval(true), 900);
  }
  function cancelHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    allow.classList.remove("holding");
  }

  allow.addEventListener("pointerdown", startHold);
  allow.addEventListener("pointerup", cancelHold);
  allow.addEventListener("pointerleave", cancelHold);
  allow.addEventListener("pointercancel", cancelHold);
  allow.addEventListener("contextmenu", (e) => e.preventDefault());
  $("deny").onclick = () => answerApproval(false);

  // ---------------------------------------------------------------------------
  // Voce in uscita

  const lang = navigator.language && navigator.language.startsWith("it") ? navigator.language : "it-IT";

  function pickVoice() {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));
    return voices.find((v) => /premium|enhanced|siri/i.test(v.name)) || voices[0];
  }

  function speak(text) {
    if (!speakEnabled || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.onstart = () => { speaking = true; render(); };
    u.onend = u.onerror = () => { speaking = false; render(); };
    speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    speaking = false;
  }

  // iOS permette la sintesi vocale solo dopo un gesto dell'utente.
  let speechUnlocked = false;
  function unlockSpeech() {
    if (speechUnlocked || !("speechSynthesis" in window)) return;
    speechUnlocked = true;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  speakToggle.onclick = () => {
    speakEnabled = !speakEnabled;
    store.set("speak", speakEnabled ? "on" : "off");
    speakToggle.setAttribute("aria-pressed", String(speakEnabled));
    if (!speakEnabled) stopSpeaking();
    render();
  };

  // ---------------------------------------------------------------------------
  // Microfono

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let finalText = "";
  let interimText = "";

  function startListening() {
    if (!Recognition) {
      input.focus();
      addTick("detta", "usa il microfono della tastiera");
      return;
    }
    stopSpeaking();
    recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    finalText = "";
    interimText = "";
    heard.textContent = "";

    recognition.onresult = (e) => {
      finalText = "";
      interimText = "";
      for (const r of e.results) {
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      heard.textContent = finalText + interimText;
      orb.kick();
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        addTick("microfono", "permesso negato: Impostazioni › Safari › Microfono", true);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        addTick("microfono", e.error, true);
      }
    };
    recognition.onend = () => {
      listening = false;
      render();
      const text = (finalText || interimText).trim();
      if (text) sendCommand(text);
      else heard.textContent = "";
    };

    try {
      recognition.start();
      listening = true;
    } catch {
      listening = false;
    }
    render();
  }

  orbBtn.onclick = () => {
    unlockSpeech();
    switch (currentState()) {
      case "listening":
        recognition?.stop();
        break;
      case "thinking":
        sendMsg({ type: "cancel" });
        addTick("stop", "comando annullato", true);
        break;
      case "speaking":
        stopSpeaking();
        render();
        break;
      case "idle":
        startListening();
        break;
    }
  };

  $("form").onsubmit = (e) => {
    e.preventDefault();
    unlockSpeech();
    sendCommand(input.value);
    input.value = "";
    input.blur();
  };

  $("reset").onclick = () => {
    if (!sendMsg({ type: "reset" })) return;
    stopSpeaking();
    heard.textContent = "";
    clearTicks();
    resetHistoryView();
    showReply("Nuova conversazione.", { accent: true });
    render();
  };

  // ---------------------------------------------------------------------------
  // La sfera: un blob vivo disegnato su canvas, che cambia carattere con lo stato

  const orb = (() => {
    const canvas = $("orb");
    const ctx = canvas.getContext("2d");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Parametri per stato: colori, ampiezza della deformazione, velocità, scala.
    const PRESETS = {
      offline:   { core: [74, 69, 64],   rim: [40, 37, 34],   glow: 0.0,  amp: 0.015, speed: 0.25, scale: 0.78, orbit: 0 },
      idle:      { core: [255, 128, 72], rim: [214, 58, 12],  glow: 0.35, amp: 0.035, speed: 0.5,  scale: 0.9,  orbit: 0 },
      listening: { core: [255, 150, 96], rim: [255, 72, 20],  glow: 0.8,  amp: 0.11,  speed: 1.6,  scale: 1.0,  orbit: 0 },
      thinking:  { core: [44, 40, 37],   rim: [24, 22, 20],   glow: 0.25, amp: 0.05,  speed: 0.9,  scale: 0.86, orbit: 1 },
      speaking:  { core: [255, 170, 120],rim: [230, 70, 20],  glow: 0.6,  amp: 0.07,  speed: 1.1,  scale: 0.95, orbit: 0 },
      approval:  { core: [255, 196, 90], rim: [230, 140, 10], glow: 0.7,  amp: 0.05,  speed: 0.7,  scale: 0.92, orbit: 0 },
    };

    const cur = structuredClone(PRESETS.offline);
    let target = PRESETS.offline;
    let stateName = "offline";
    let energy = 0;
    let t = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    addEventListener("resize", resize);
    resize();

    const lerp = (a, b, k) => a + (b - a) * k;
    const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

    function blobPath(cx, cy, r, amp, phase, seed) {
      const N = 72;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const n =
          Math.sin(a * 3 + phase * 1.3 + seed) * 0.5 +
          Math.sin(a * 5 - phase * 0.9 + seed * 2) * 0.3 +
          Math.sin(a * 2 + phase * 0.6 - seed) * 0.4;
        const rr = r * (1 + amp * n);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    }

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.pow(0.02, dt); // avvicinamento morbido al preset
      for (const key of ["glow", "amp", "speed", "scale", "orbit"]) cur[key] = lerp(cur[key], target[key], k);
      for (const key of ["core", "rim"]) for (let i = 0; i < 3; i++) cur[key][i] = lerp(cur[key][i], target[key][i], k);
      energy *= Math.pow(0.08, dt);
      t += dt * (reduced ? 0.15 : cur.speed + energy * 2);

      const cx = w / 2;
      const cy = h / 2;
      const base = (Math.min(w, h) / 2) * 0.72;
      const pulse = stateName === "speaking" ? Math.sin(t * 6) * 0.025 + Math.sin(t * 2.3) * 0.02 : 0;
      const breathe = Math.sin(t * 1.4) * 0.012;
      const R = base * (cur.scale + pulse + breathe + energy * 0.06);
      const amp = cur.amp + energy * 0.08;

      ctx.clearRect(0, 0, w, h);

      // Alone
      if (cur.glow > 0.01) {
        const g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.55);
        g.addColorStop(0, rgb(cur.rim, 0.35 * cur.glow));
        g.addColorStop(1, rgb(cur.rim, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Onde di ascolto
      if (stateName === "listening" && !reduced) {
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.35 + i / 3) % 1;
          ctx.beginPath();
          ctx.arc(cx, cy, R * (1 + p * 0.5), 0, Math.PI * 2);
          ctx.strokeStyle = rgb(cur.rim, (1 - p) * 0.45);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Strati del blob, dal più esterno al più interno
      const layers = [
        { s: 1.0, a: 1.0, seed: 0.0, fill: cur.rim },
        { s: 0.9, a: 0.9, seed: 1.7, fill: cur.core },
        { s: 0.66, a: 0.55, seed: 3.1, fill: [Math.min(255, cur.core[0] + 30), Math.min(255, cur.core[1] + 40), Math.min(255, cur.core[2] + 40)] },
      ];
      for (const L of layers) {
        blobPath(cx, cy, R * L.s, amp * (1.2 - L.s * 0.4), t * (1 + L.seed * 0.15), L.seed);
        const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R * L.s * 1.1);
        g.addColorStop(0, rgb(L.fill, L.a));
        g.addColorStop(1, rgb(cur.rim, L.a * 0.9));
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Riflesso speculare
      const hl = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.45, 0, cx - R * 0.35, cy - R * 0.45, R * 0.7);
      hl.addColorStop(0, "rgba(255,255,255,.22)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
      ctx.fill();

      // Scintille in orbita mentre lavora
      if (cur.orbit > 0.02) {
        for (let i = 0; i < 3; i++) {
          const a = t * (1.6 + i * 0.35) + (i * Math.PI * 2) / 3;
          const rr = R * (1.12 + 0.06 * Math.sin(t * 2 + i));
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr * 0.92;
          ctx.beginPath();
          ctx.arc(x, y, 3.2 - i * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,91,31,${cur.orbit * (1 - i * 0.22)})`;
          ctx.shadowColor = "rgba(255,91,31,.9)";
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      setState(s) {
        stateName = s;
        target = PRESETS[s] || PRESETS.idle;
      },
      kick() {
        energy = Math.min(1, energy + 0.5);
      },
    };
  })();

  // ---------------------------------------------------------------------------
  // Orologio

  function tickClock() {
    const now = new Date();
    $("clockTime").textContent = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    $("clockDate").textContent = now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  }
  tickClock();
  setInterval(tickClock, 10000);

  // ---------------------------------------------------------------------------
  // Schermo sempre acceso e riconnessione al risveglio

  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        await navigator.wakeLock.request("screen");
      }
    } catch {}
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      keepAwake();
      connect();
    }
  });
  document.addEventListener("click", keepAwake, { once: true });

  setInterval(() => ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 25000);

  render();
  connect();
})();
