// Web app per l'iPhone: microfono → testo → Mac, e legge ad alta voce la risposta.

(() => {
  const $ = (id) => document.getElementById(id);
  const log = $("log");
  const live = $("live");
  const mic = $("mic");
  const input = $("text");
  const dot = $("dot");
  const hostLabel = $("host");
  const speakToggle = $("speakToggle");

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const params = new URLSearchParams(location.search);
  const token = params.get("t") || store.get("token");
  if (params.get("t")) store.set("token", params.get("t"));

  let ws = null;
  let busy = false;
  let speakEnabled = store.get("speak") !== "off";
  let pendingApprovalId = null;
  let retryDelay = 1000;

  speakToggle.setAttribute("aria-pressed", String(speakEnabled));

  // ---- Log --------------------------------------------------------------

  function add(kind, text) {
    const el = document.createElement("div");
    el.className = `msg ${kind}`;
    el.textContent = text;
    log.appendChild(el);
    while (log.children.length > 80) log.firstChild.remove();
    log.parentElement.scrollTop = log.parentElement.scrollHeight;
  }

  function setBusy(value) {
    busy = value;
    mic.classList.toggle("busy", value);
    if (value) live.textContent = "Ci penso…";
    else if (!listening) live.textContent = "";
  }

  // ---- Connessione ------------------------------------------------------

  function connect() {
    if (!token) {
      hostLabel.textContent = "Manca il codice: apri il link mostrato sul Mac";
      return;
    }
    if (ws && ws.readyState <= WebSocket.OPEN) return;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${location.host}/ws?t=${encodeURIComponent(token)}`);
    ws = socket;

    socket.onopen = () => {
      retryDelay = 1000;
      dot.classList.add("on");
    };
    socket.onclose = () => {
      if (ws !== socket) return;
      dot.classList.remove("on");
      hostLabel.textContent = "Mac non raggiungibile, riprovo…";
      setBusy(false);
      closeApproval();
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
    add("error", "Non connesso al Mac.");
    return false;
  }

  function handle(msg) {
    switch (msg.type) {
      case "hello":
        hostLabel.textContent = msg.host.replace(/\.local$/, "");
        setBusy(msg.busy);
        break;
      case "busy":
        setBusy(msg.busy);
        break;
      case "status":
        add("info", msg.text);
        break;
      case "tool":
        add("tool", `⚙︎ ${msg.name}${msg.detail ? `  ${msg.detail.split("\n")[0].slice(0, 120)}` : ""}`);
        break;
      case "approval":
        openApproval(msg);
        break;
      case "reply":
        add("ai", msg.text);
        speak(msg.text);
        break;
      case "error":
        add("error", msg.text);
        speak(msg.text);
        break;
    }
  }

  function sendCommand(text) {
    text = text.trim();
    if (!text) return;
    if (busy) {
      add("error", "Aspetta, sto ancora lavorando.");
      return;
    }
    if (sendMsg({ type: "command", text })) add("user", text);
  }

  // ---- Approvazioni -----------------------------------------------------

  function openApproval(msg) {
    pendingApprovalId = msg.id;
    $("approvalName").textContent = msg.name;
    $("approvalDetail").textContent = msg.detail || "";
    $("approval").hidden = false;
    if (navigator.vibrate) navigator.vibrate(80);
    speak("Serve la tua conferma.");
  }

  function closeApproval() {
    pendingApprovalId = null;
    $("approval").hidden = true;
  }

  function answerApproval(ok) {
    if (pendingApprovalId) sendMsg({ type: "approval", id: pendingApprovalId, ok });
    closeApproval();
  }

  $("allow").onclick = () => answerApproval(true);
  $("deny").onclick = () => answerApproval(false);

  // ---- Voce in uscita ---------------------------------------------------

  const lang = navigator.language && navigator.language.startsWith("it") ? navigator.language : "it-IT";

  function speak(text) {
    if (!speakEnabled || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = speechSynthesis.getVoices().find((v) => v.lang === lang && /premium|enhanced|siri/i.test(v.name))
      || speechSynthesis.getVoices().find((v) => v.lang === lang);
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  // iOS permette la sintesi vocale solo dopo un gesto dell'utente: la "sblocchiamo" al primo tocco.
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
    if (!speakEnabled && "speechSynthesis" in window) speechSynthesis.cancel();
  };

  // ---- Microfono --------------------------------------------------------

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let finalText = "";

  function startListening() {
    if (!Recognition) {
      // Fallback: la tastiera di iOS ha il tasto microfono per la dettatura.
      input.focus();
      live.textContent = "Usa il 🎤 della tastiera per dettare";
      return;
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    finalText = "";

    recognition.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (const r of e.results) {
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      live.textContent = finalText + interim;
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        add("error", "Permesso microfono negato. Controlla Impostazioni → Safari → Microfono, oppure usa la dettatura della tastiera.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        add("error", `Microfono: ${e.error}`);
      }
    };
    recognition.onend = () => {
      listening = false;
      mic.classList.remove("listening");
      const text = (finalText || live.textContent).trim();
      live.textContent = "";
      if (text) sendCommand(text);
    };

    listening = true;
    mic.classList.add("listening");
    live.textContent = "Ti ascolto…";
    try {
      recognition.start();
    } catch {
      listening = false;
      mic.classList.remove("listening");
    }
  }

  function stopListening() {
    if (recognition && listening) recognition.stop();
  }

  mic.onclick = () => {
    unlockSpeech();
    if (busy) {
      if (confirm("Annullare il comando in corso?")) sendMsg({ type: "cancel" });
      return;
    }
    if (listening) stopListening();
    else startListening();
  };

  $("form").onsubmit = (e) => {
    e.preventDefault();
    unlockSpeech();
    sendCommand(input.value);
    input.value = "";
    input.blur();
  };

  $("reset").onclick = () => {
    log.innerHTML = "";
    sendMsg({ type: "reset" });
  };

  // ---- Schermo sempre acceso -------------------------------------------

  let wakeLock = null;
  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        wakeLock = await navigator.wakeLock.request("screen");
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

  // Ping periodico: tiene viva la connessione quando lo schermo resta acceso a lungo.
  setInterval(() => ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 25000);

  if (!window.isSecureContext && Recognition) {
    add("info", "Per usare il microfono apri la pagina in HTTPS.");
  }
  add("info", "Tocca il microfono e dimmi cosa fare sul Mac.");
  connect();
})();
