// IDLE SYNC — web app per iPhone, iPad e browser.
// Microfono → testo → Mac; la risposta arriva in streaming e viene letta ad alta voce.
// Tutti i dispositivi collegati condividono conversazione, cronologia e impostazioni.

(() => {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const card = $("card");
  const heard = $("heard");
  const reply = $("reply");
  const steps = $("steps");
  const caption = $("caption");
  const orbBtn = $("orbBtn");
  const input = $("text");
  const field = $("form");
  const hostLabel = $("host");
  const log = $("log");

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const params = new URLSearchParams(location.search);
  const token = params.get("t") || store.get("token");
  if (params.get("t")) store.set("token", params.get("t"));

  const ua = navigator.userAgent;
  const guessedDevice = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad"
    : /iPhone/.test(ua) ? "iPhone" : /Macintosh/.test(ua) ? "Mac" : "Browser";

  // Preferenze locali di questo dispositivo
  const local = {
    device: store.get("device") || guessedDevice,
    speak: store.get("speak") !== "off",
    voice: store.get("voice") || "",
    rate: Number(store.get("rate")) || 1,
    theme: store.get("theme") || "auto",
  };

  // Stato condiviso, ricevuto dal Mac
  let me = null;
  let settings = { effort: "low", autoApprove: false, instructions: "", quickActions: [] };
  let devices = [];
  let mac = null;

  let ws = null;
  let connected = false;
  let busy = false;
  let listening = false;
  let speaking = false;
  let pendingApprovalId = null;
  let retryDelay = 1000;
  let exchange = null; // { user, origin }
  let streamText = "";

  // ---------------------------------------------------------------------------
  // Icone in stile simboli di sistema

  const ICON = {
    app: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    close: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
    laptop: '<rect x="5" y="5" width="14" height="10" rx="1.8"/><path d="M3 18.5h18"/>',
    speaker: '<path d="M4 10v4h3.5L12 18V6L7.5 10H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
    play: '<path d="M7 5.5v13l11-6.5z"/>',
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14.5h8"/>',
    command: '<path d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9zm0 0h6m-6 0v6m6-6V6.5A2.5 2.5 0 1 1 17.5 9H15zm0 0v6m0 0h-6m6 0v2.5a2.5 2.5 0 1 0 2.5-2.5H15zm-6 0v2.5A2.5 2.5 0 1 1 6.5 15H9z"/>',
    viewfinder: '<path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"/><circle cx="12" cy="12" r="3"/>',
    clipboard: '<rect x="6" y="5" width="12" height="16" rx="2.5"/><path d="M9.5 3.5h5v3h-5z"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    waveform: '<path d="M4 12h.01M7.5 9v6M11 5.5v13M14.5 8v8M18 10.5v3M21 12h.01"/>',
    sparkles: '<path d="M11 3.5l1.6 4.4 4.4 1.6-4.4 1.6L11 15.5l-1.6-4.4L5 9.5l4.4-1.6zM18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z"/>',
    terminal: '<rect x="3" y="4.5" width="18" height="15" rx="3.5"/><path d="M7 10l3 2.5L7 15M12.5 15H17"/>',
    script: '<path d="M8 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2"/><path d="M9 9h6M9 12.5h6M9 16h3"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    bulb: '<path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    tablet: '<rect x="4.5" y="3" width="15" height="18" rx="2.5"/><path d="M11 18h2"/>',
    minus: '<circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none"/><path d="M8.5 12h7" stroke="#fff" stroke-width="2.2"/>',
  };
  const QA_ICONS = ["play", "viewfinder", "moon", "laptop", "sparkles", "globe", "bulb", "mail", "speaker", "terminal"];

  const TOOLS = {
    open_app:        { icon: "app",        title: (d) => `Apro ${d || "l'app"}` },
    quit_app:        { icon: "close",      title: (d) => `Chiudo ${d || "l'app"}` },
    open_url:        { icon: "globe",      title: () => "Apro il link", detail: true },
    get_status:      { icon: "laptop",     title: () => "Controllo il Mac" },
    set_volume:      { icon: "speaker",    title: () => "Regolo il volume" },
    media_control:   { icon: "play",       title: () => "Controllo la musica" },
    type_text:       { icon: "keyboard",   title: () => "Scrivo il testo", detail: true },
    press_keys:      { icon: "command",    title: (d) => `Premo ${d}` },
    take_screenshot: { icon: "viewfinder", title: () => "Guardo lo schermo" },
    clipboard:       { icon: "clipboard",  title: () => "Uso gli appunti" },
    notify:          { icon: "bell",       title: () => "Invio una notifica" },
    speak_on_mac:    { icon: "waveform",   title: () => "Parlo dal Mac" },
    list_shortcuts:  { icon: "sparkles",   title: () => "Cerco i Comandi Rapidi" },
    run_shortcut:    { icon: "sparkles",   title: (d) => `Eseguo «${d}»` },
    run_applescript: { icon: "script",     title: () => "Eseguo uno script", detail: true },
    run_shell:       { icon: "terminal",   title: () => "Eseguo un comando", detail: true },
  };

  const svg = (name, cls = "") => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICON[name] || ICON.sparkles}</svg>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------------------------------------------------------------------------
  // Stato

  const CAPTIONS = {
    offline: "Mac non raggiungibile",
    idle: "Tocca per parlare",
    listening: "Ti ascolto…",
    thinking: "Tocca per interrompere",
    speaking: "Tocca per zittire",
    approval: "In attesa di conferma",
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
    caption.textContent = !token ? "Apri il link mostrato sul Mac" : CAPTIONS[s];
    orbBtn.setAttribute("aria-label", CAPTIONS[s]);
    orb.setState(s);
  }

  let toastTimer = null;
  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2800);
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

  $("cardClose").onclick = () => {
    if (!busy) hideCard();
  };

  // ---------------------------------------------------------------------------
  // Cronologia (condivisa, salvata sul Mac)

  const timeFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", hour: "2-digit", minute: "2-digit" });

  function historyItem(entry) {
    const li = document.createElement("li");
    const tools = (entry.tools || []).map((n) => (TOOLS[n] ? TOOLS[n].title("").replace(/\s*«?»?$/, "") : n));
    li.innerHTML = `
      <p class="meta">${esc(timeFmt.format(entry.ts))} · ${esc(entry.device || "")}</p>
      <p class="u">${esc(entry.user || "")}</p>
      <p class="a">${esc(entry.reply || "")}</p>`;
    if (tools.length) {
      const t = document.createElement("p");
      t.className = "meta";
      t.style.margin = "8px 0 0";
      t.textContent = [...new Set(tools)].join(" · ");
      li.appendChild(t);
    }
    return li;
  }

  function renderHistory(entries) {
    log.innerHTML = "";
    if (!entries.length) {
      log.innerHTML = '<li class="empty">Nessuna richiesta</li>';
      return;
    }
    for (const e of [...entries].reverse()) log.appendChild(historyItem(e));
  }

  function prependHistory(entry) {
    log.querySelector(".empty")?.remove();
    log.prepend(historyItem(entry));
    while (log.children.length > 100) log.lastChild.remove();
  }

  // ---------------------------------------------------------------------------
  // Widget del Mac

  let volDragging = false;
  const volSlider = $("volSlider");

  function paintRange(el) {
    const min = Number(el.min);
    const max = Number(el.max);
    el.style.setProperty("--p", `${((Number(el.value) - min) / (max - min)) * 100}%`);
  }

  function renderMac() {
    const w = $("widgets");
    if (!mac) {
      w.hidden = true;
      return;
    }
    w.hidden = false;

    const np = mac.nowPlaying;
    $("wPlaying").hidden = !np;
    $("wApp").hidden = !!np || !mac.app;
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

  let volTimer = null;
  volSlider.addEventListener("input", () => {
    volDragging = true;
    paintRange(volSlider);
    clearTimeout(volTimer);
    volTimer = setTimeout(() => sendMsg({ type: "control", action: "volume", value: Number(volSlider.value) }), 120);
  });
  volSlider.addEventListener("change", () => {
    sendMsg({ type: "control", action: "volume", value: Number(volSlider.value) });
    setTimeout(() => (volDragging = false), 800);
  });
  $("muteBtn").onclick = () => sendMsg({ type: "control", action: "mute" });
  document.querySelectorAll("[data-control]").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.control === "playpause" && mac?.nowPlaying) {
        mac.nowPlaying.playing = !mac.nowPlaying.playing; // risposta immediata, poi conferma dal Mac
        renderMac();
      }
      sendMsg({ type: "control", action: b.dataset.control });
    };
  });

  // ---------------------------------------------------------------------------
  // Azioni rapide

  function renderQuick() {
    const q = $("quick");
    q.innerHTML = "";
    for (const a of settings.quickActions) {
      const b = document.createElement("button");
      b.className = "chip material";
      b.setAttribute("role", "listitem");
      b.innerHTML = `${svg(a.icon)}<span></span>`;
      b.querySelector("span").textContent = a.label;
      b.onclick = () => {
        unlockSpeech();
        sendCommand(a.prompt);
      };
      q.appendChild(b);
    }
  }

  // ---------------------------------------------------------------------------
  // Connessione

  function connect() {
    if (!token) {
      hostLabel.textContent = "Non abbinato";
      render();
      return;
    }
    if (ws && ws.readyState <= WebSocket.OPEN) return;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${location.host}/ws?t=${encodeURIComponent(token)}`);
    ws = socket;

    socket.onopen = () => {
      retryDelay = 1000;
      connected = true;
      socket.send(JSON.stringify({ type: "hi", device: local.device }));
      render();
    };
    socket.onclose = () => {
      if (ws !== socket) return;
      connected = false;
      busy = false;
      hostLabel.textContent = "Non connesso";
      $("deviceCount").hidden = true;
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
    toast("Il Mac non è raggiungibile.");
    return false;
  }

  function handle(msg) {
    switch (msg.type) {
      case "hello":
        me = msg.you;
        hostLabel.textContent = msg.host.replace(/\.local$/, "");
        $("heroSub").textContent = `Versione ${msg.version} · ${msg.host.replace(/\.local$/, "")}`;
        busy = msg.busy;
        settings = msg.settings;
        mac = msg.mac;
        renderSettings();
        renderQuick();
        renderMac();
        renderHistory(msg.history || []);
        render();
        break;
      case "devices":
        devices = msg.devices;
        renderDevices();
        break;
      case "settings":
        settings = msg.settings;
        renderSettings();
        renderQuick();
        break;
      case "mac":
        mac = msg.status;
        renderMac();
        break;
      case "busy":
        busy = msg.busy;
        if (!busy) settleSteps();
        render();
        break;
      case "command":
        exchange = { user: msg.text, origin: msg.origin };
        showCard();
        heard.textContent = msg.origin === me ? msg.text : `${msg.device}: ${msg.text}`;
        steps.innerHTML = "";
        streamText = "";
        setReply("Un attimo…", { pending: true });
        break;
      case "step":
        streamText = "";
        break;
      case "delta":
        showCard();
        streamText += msg.text;
        setReply(streamText, { animate: false });
        break;
      case "status":
        if (!streamText) setReply(msg.text, { pending: true });
        break;
      case "tool":
        showCard();
        addStep(msg.name, msg.detail);
        break;
      case "approval":
        openApproval(msg);
        break;
      case "approval:done":
        if (pendingApprovalId === msg.id) {
          closeApproval();
          render();
        }
        break;
      case "reply":
      case "error":
        showCard();
        settleSteps();
        if (msg.type === "error") addStep("error", msg.text, { error: true });
        setReply(msg.text, { animate: !streamText || msg.type === "error" });
        streamText = "";
        if (msg.origin === me) speak(msg.text);
        exchange = null;
        break;
      case "history:add":
        prependHistory(msg.entry);
        break;
      case "history:clear":
        renderHistory([]);
        break;
      case "reset":
        heard.textContent = "";
        steps.innerHTML = "";
        reply.textContent = "";
        hideCard();
        break;
      case "toast":
        toast(msg.text);
        break;
    }
  }

  function sendCommand(text) {
    text = text.trim();
    if (!text) return;
    if (busy) {
      toast("Sto ancora lavorando al comando precedente.");
      return;
    }
    sendMsg({ type: "command", text });
  }

  // ---------------------------------------------------------------------------
  // Foglio di conferma con "scorri per eseguire"

  const sheet = $("approval");
  const sheetScrim = $("sheetScrim");
  const slider = $("slider");
  const knob = slider.querySelector(".knob");

  function openApproval(msg) {
    pendingApprovalId = msg.id;
    const titles = {
      run_shell: "Eseguire un comando nel Terminale?",
      run_applescript: "Eseguire uno script AppleScript?",
    };
    $("approvalTitle").textContent = titles[msg.name] || `Consentire «${msg.name}»?`;
    $("approvalDetail").textContent = msg.detail || "";
    resetSlider(false);
    sheet.hidden = false;
    sheetScrim.hidden = false;
    closeMenu();
    if (exchange?.origin === me) speak("Serve la tua conferma.");
    render();
  }

  function closeApproval() {
    pendingApprovalId = null;
    sheet.hidden = true;
    sheetScrim.hidden = true;
  }

  function answerApproval(ok) {
    if (pendingApprovalId) sendMsg({ type: "approval", id: pendingApprovalId, ok });
    closeApproval();
    render();
  }

  let drag = null;
  const maxX = () => slider.clientWidth - knob.offsetWidth - 10;

  function setKnob(x) {
    knob.style.transform = `translateX(${x}px)`;
    const p = Math.round((x / maxX()) * 100);
    slider.setAttribute("aria-valuenow", String(p));
    slider.querySelector(".slider-text").style.opacity = String(Math.max(0, 1 - p / 60));
  }

  function resetSlider(animated = true) {
    slider.classList.toggle("back", animated);
    setKnob(0);
  }

  knob.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    knob.setPointerCapture(e.pointerId);
    slider.classList.remove("back");
    drag = { startX: e.clientX };
  });
  knob.addEventListener("pointermove", (e) => {
    if (!drag) return;
    setKnob(Math.max(0, Math.min(maxX(), e.clientX - drag.startX)));
  });
  const endDrag = (e) => {
    if (!drag) return;
    const x = Math.max(0, Math.min(maxX(), e.clientX - drag.startX));
    drag = null;
    if (x >= maxX() * 0.92) {
      setKnob(maxX());
      setTimeout(() => answerApproval(true), 120);
    } else {
      resetSlider(true);
    }
  };
  knob.addEventListener("pointerup", endDrag);
  knob.addEventListener("pointercancel", endDrag);
  slider.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") answerApproval(true);
  });
  $("deny").onclick = () => answerApproval(false);

  // ---------------------------------------------------------------------------
  // Menu "…" e pagine

  const menu = $("menu");
  const menuBtn = $("menuBtn");
  const menuScrim = $("menuScrim");

  function openMenu() {
    menu.hidden = false;
    menuScrim.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    menu.hidden = true;
    menuScrim.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
  }
  menuBtn.onclick = () => (menu.hidden ? openMenu() : closeMenu());
  menuScrim.onclick = closeMenu;

  $("historyBtn").onclick = () => {
    closeMenu();
    $("history").hidden = false;
  };
  $("optionsBtn").onclick = () => {
    closeMenu();
    renderSettings();
    $("options").hidden = false;
  };
  document.querySelectorAll("[data-close]").forEach((b) => {
    b.onclick = () => ($(b.dataset.close).hidden = true);
  });

  $("reset").onclick = () => {
    closeMenu();
    stopSpeaking();
    sendMsg({ type: "reset" });
  };

  // ---------------------------------------------------------------------------
  // Opzioni

  function setSegmented(seg, value) {
    const buttons = [...seg.querySelectorAll("button")];
    buttons.forEach((b, i) => {
      const on = b.dataset.value === value;
      b.setAttribute("aria-checked", String(on));
      if (on) seg.querySelector(".seg-thumb").style.transform = `translateX(${i * 100}%)`;
    });
  }

  function pushSettings(patch) {
    settings = { ...settings, ...patch };
    sendMsg({ type: "settings", patch: settings });
  }

  function renderDevices() {
    const count = devices.length;
    const badge = $("deviceCount");
    badge.hidden = count < 2;
    badge.textContent = `· ${count} dispositivi`;
    const list = $("deviceList");
    list.innerHTML = "";
    for (const d of devices) {
      const row = document.createElement("div");
      row.className = "cell";
      const icon = /iPad/i.test(d.device) ? "tablet" : /Mac|Browser/i.test(d.device) ? "laptop" : "phone";
      row.innerHTML = `<span class="dev-icon">${svg(icon)}</span><span class="cell-label"></span>${d.id === me ? '<span class="tag">Questo dispositivo</span>' : ""}`;
      row.querySelector(".cell-label").textContent = d.device;
      list.appendChild(row);
    }
  }

  function renderQaList() {
    const list = $("qaList");
    list.innerHTML = "";
    settings.quickActions.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "cell";
      row.innerHTML = `
        <button class="qa-del" aria-label="Elimina">${svg("minus")}</button>
        <span class="tile">${svg(a.icon)}</span>
        <span class="qa-text"><span class="qa-label"></span><span class="qa-prompt"></span></span>`;
      row.querySelector(".qa-label").textContent = a.label;
      row.querySelector(".qa-prompt").textContent = a.prompt;
      row.querySelector(".qa-del").onclick = () => {
        pushSettings({ quickActions: settings.quickActions.filter((_, j) => j !== i) });
        renderQaList();
        renderQuick();
      };
      list.appendChild(row);
    });
  }

  function renderSettings() {
    setSegmented($("effortSeg"), settings.effort);
    if (document.activeElement !== $("instructions")) $("instructions").value = settings.instructions || "";
    $("confirmSwitch").checked = !settings.autoApprove;
    renderQaList();
  }

  $("effortSeg").querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      setSegmented($("effortSeg"), b.dataset.value);
      pushSettings({ effort: b.dataset.value });
    };
  });

  let instrTimer = null;
  $("instructions").addEventListener("input", () => {
    clearTimeout(instrTimer);
    instrTimer = setTimeout(() => pushSettings({ instructions: $("instructions").value }), 700);
  });

  $("confirmSwitch").onchange = () => {
    if (!$("confirmSwitch").checked && !confirm("Senza conferma, IDLE SYNC potrà eseguire comandi del Terminale da solo. Continuare?")) {
      $("confirmSwitch").checked = true;
      return;
    }
    pushSettings({ autoApprove: !$("confirmSwitch").checked });
  };

  const deviceInput = $("deviceName");
  deviceInput.value = local.device;
  deviceInput.addEventListener("change", () => {
    local.device = deviceInput.value.trim() || guessedDevice;
    deviceInput.value = local.device;
    store.set("device", local.device);
    sendMsg({ type: "hi", device: local.device });
  });

  // Nuova azione rapida
  let qaIcon = "sparkles";
  const qaForm = $("qaForm");
  const qaIcons = $("qaIcons");
  QA_ICONS.forEach((name) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", name);
    b.innerHTML = svg(name);
    b.onclick = () => {
      qaIcon = name;
      qaIcons.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    };
    qaIcons.appendChild(b);
  });
  $("qaAdd").onclick = () => {
    qaForm.hidden = false;
    $("qaAdd").hidden = true;
    qaIcon = "sparkles";
    qaIcons.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x.getAttribute("aria-label") === qaIcon)));
    $("qaLabel").focus();
  };
  $("qaCancel").onclick = () => {
    qaForm.hidden = true;
    $("qaAdd").hidden = false;
    qaForm.reset();
  };
  qaForm.onsubmit = (e) => {
    e.preventDefault();
    const label = $("qaLabel").value.trim();
    const prompt = $("qaPrompt").value.trim();
    if (!label || !prompt) return;
    pushSettings({ quickActions: [...settings.quickActions, { id: `qa-${Date.now()}`, label, prompt, icon: qaIcon }] });
    qaForm.reset();
    qaForm.hidden = true;
    $("qaAdd").hidden = false;
    renderQaList();
    renderQuick();
  };

  $("clearHistory").onclick = () => {
    if (confirm("Cancellare la cronologia su tutti i dispositivi?")) sendMsg({ type: "history:clear" });
  };

  // ---------------------------------------------------------------------------
  // Voce in uscita

  const lang = navigator.language && navigator.language.startsWith("it") ? navigator.language : "it-IT";
  const speakSwitch = $("speakSwitch");
  const voiceSelect = $("voiceSelect");
  const rateSlider = $("rateSlider");
  speakSwitch.checked = local.speak;
  rateSlider.value = String(local.rate);
  paintRange(rateSlider);

  function voicesForLang() {
    if (!("speechSynthesis" in window)) return [];
    return speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));
  }

  function renderVoices() {
    const voices = voicesForLang();
    voiceSelect.innerHTML = '<option value="">Automatica</option>';
    for (const v of voices) {
      const o = document.createElement("option");
      o.value = v.voiceURI;
      o.textContent = v.name;
      voiceSelect.appendChild(o);
    }
    voiceSelect.value = voices.some((v) => v.voiceURI === local.voice) ? local.voice : "";
  }
  if ("speechSynthesis" in window) {
    renderVoices();
    speechSynthesis.addEventListener?.("voiceschanged", renderVoices);
  }

  function pickVoice() {
    const voices = voicesForLang();
    return voices.find((v) => v.voiceURI === local.voice)
      || voices.find((v) => /premium|enhanced|siri/i.test(v.name))
      || voices[0];
  }

  function speak(text) {
    if (!local.speak || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = local.rate;
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

  speakSwitch.onchange = () => {
    local.speak = speakSwitch.checked;
    store.set("speak", local.speak ? "on" : "off");
    if (!local.speak) stopSpeaking();
    render();
  };
  voiceSelect.onchange = () => {
    local.voice = voiceSelect.value;
    store.set("voice", local.voice);
    unlockSpeech();
    speak("Ciao, questa è la mia voce.");
  };
  rateSlider.addEventListener("input", () => paintRange(rateSlider));
  rateSlider.addEventListener("change", () => {
    local.rate = Number(rateSlider.value);
    store.set("rate", String(local.rate));
    unlockSpeech();
    speak("Ciao, questa è la mia velocità.");
  });

  // ---------------------------------------------------------------------------
  // Microfono

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let finalText = "";
  let interimText = "";

  function startListening() {
    if (!Recognition) {
      input.focus();
      return;
    }
    stopSpeaking();
    recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    finalText = "";
    interimText = "";

    recognition.onresult = (e) => {
      finalText = "";
      interimText = "";
      for (const r of e.results) {
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      showCard();
      heard.textContent = "";
      steps.innerHTML = "";
      setReply(finalText + interimText, { pending: true, animate: false });
      orb.kick();
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast("Consenti il microfono in Impostazioni › Safari › Microfono.");
      }
    };
    recognition.onend = () => {
      listening = false;
      render();
      const text = (finalText || interimText).trim();
      if (text) sendCommand(text);
      else if (!busy && !reply.textContent.trim()) hideCard();
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

  input.addEventListener("input", () => field.classList.toggle("ready", input.value.trim().length > 0));
  field.onsubmit = (e) => {
    e.preventDefault();
    unlockSpeech();
    sendCommand(input.value);
    input.value = "";
    field.classList.remove("ready");
    input.blur();
  };

  // ---------------------------------------------------------------------------
  // La sfera: colori fluidi che si muovono dentro un cerchio di vetro

  const orb = (() => {
    const canvas = $("orb");
    const ctx = canvas.getContext("2d");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const PALETTE = {
      // Almond Hearth, rosa velluto e Velvet Curfew su Obsidian Ink
      dark: {
        base: [75, 38, 47],
        blobs: [[255, 226, 200], [214, 128, 152], [150, 62, 88], [255, 176, 140]],
        rim: [238, 211, 186],
      },
      // Royal Amethyst con lavanda, indaco e rosa
      light: {
        base: [96, 52, 150],
        blobs: [[183, 154, 224], [91, 91, 214], [224, 138, 200], [240, 232, 255]],
        rim: [255, 255, 255],
      },
    };

    // Carattere di ogni stato: dimensione, velocità, intensità dei colori, alone, saturazione.
    const MOODS = {
      offline:   { scale: 0.82, speed: 0.25, glow: 0.0,  intensity: 0.35, color: 0 },
      idle:      { scale: 0.92, speed: 0.45, glow: 0.35, intensity: 0.8,  color: 1 },
      listening: { scale: 1.06, speed: 1.4,  glow: 0.9,  intensity: 1.0,  color: 1 },
      thinking:  { scale: 0.86, speed: 2.4,  glow: 0.45, intensity: 0.75, color: 1 },
      speaking:  { scale: 0.98, speed: 1.0,  glow: 0.7,  intensity: 0.95, color: 1 },
      approval:  { scale: 0.88, speed: 0.4,  glow: 0.2,  intensity: 0.5,  color: 0.6 },
    };

    let theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    let mood = "offline";
    const cur = { ...MOODS.offline };
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
    const gray = (c, amount) => {
      const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
      return c.map((v) => lerp(g, v, amount));
    };
    const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.pow(0.015, dt);
      const target = MOODS[mood];
      for (const key in cur) cur[key] = lerp(cur[key], target[key], k);
      energy *= Math.pow(0.1, dt);
      t += dt * (reduced ? 0.1 : cur.speed + energy * 1.5);

      const pal = PALETTE[theme];
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) / 2 / 1.6; // il canvas è il 160% del pulsante
      const pulse = mood === "speaking" ? Math.sin(t * 5) * 0.03 + Math.sin(t * 1.7) * 0.02 : Math.sin(t * 1.2) * 0.012;
      const R = base * (cur.scale + pulse + energy * 0.08);

      ctx.clearRect(0, 0, w, h);

      // Alone colorato
      if (cur.glow > 0.01) {
        const g = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.65);
        g.addColorStop(0, rgba(gray(pal.blobs[1], cur.color), 0.45 * cur.glow));
        g.addColorStop(1, rgba(pal.blobs[1], 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Corpo della sfera
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = rgba(gray(pal.base, cur.color), 1);
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      ctx.globalCompositeOperation = "screen";
      pal.blobs.forEach((c, i) => {
        const p = i * 1.9;
        const bx = cx + Math.sin(t * (0.9 + i * 0.23) + p) * R * 0.48;
        const by = cy + Math.cos(t * (0.7 + i * 0.31) + p * 1.3) * R * 0.48;
        const br = R * (0.62 + 0.14 * Math.sin(t * 0.8 + i));
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, rgba(gray(c, cur.color), cur.intensity));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      });
      ctx.globalCompositeOperation = "source-over";

      // Profondità: bordo più scuro e riflesso in alto, come una biglia di vetro
      const shade = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,.16)");
      ctx.fillStyle = shade;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      const hl = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.55, 0, cx - R * 0.25, cy - R * 0.55, R * 0.75);
      hl.addColorStop(0, "rgba(255,255,255,.35)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hl;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(pal.rim, 0.22);
      ctx.lineWidth = 1;
      ctx.stroke();

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      setState(s) { mood = MOODS[s] ? s : "idle"; },
      setTheme(th) { theme = th; },
      kick() { energy = Math.min(1, energy + 0.5); },
    };
  })();

  // ---------------------------------------------------------------------------
  // Tema: automatico (segue il dispositivo), chiaro o scuro

  const systemLight = matchMedia("(prefers-color-scheme: light)");

  function applyTheme() {
    const resolved = local.theme === "auto" ? (systemLight.matches ? "light" : "dark") : local.theme;
    document.documentElement.dataset.theme = resolved;
    $("themeColor").setAttribute("content", resolved === "light" ? "#cfcfcf" : "#151311");
    setSegmented($("themeSeg"), local.theme);
    orb.setTheme(resolved);
  }

  $("themeSeg").querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      local.theme = b.dataset.value;
      store.set("theme", local.theme);
      applyTheme();
    };
  });
  systemLight.addEventListener("change", applyTheme);
  applyTheme();

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
