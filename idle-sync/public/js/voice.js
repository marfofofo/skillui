// Voce: sintesi (risposte lette ad alta voce) e riconoscimento (microfono).

import { store } from "./util.js";

export const lang = navigator.language && navigator.language.startsWith("it") ? navigator.language : "it-IT";
const hasTts = "speechSynthesis" in window;

export function createSpeaker({ onChange }) {
  const prefs = {
    enabled: store.get("speak") !== "off",
    voice: store.get("voice") || "",
    rate: Number(store.get("rate")) || 1,
  };
  let speaking = false;
  let unlocked = false;

  const voices = () =>
    hasTts ? speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2))) : [];

  function pick() {
    const list = voices();
    return list.find((v) => v.voiceURI === prefs.voice) || list.find((v) => /premium|enhanced|siri/i.test(v.name)) || list[0];
  }

  function set(value) {
    speaking = value;
    onChange();
  }

  return {
    prefs,
    voices,
    get speaking() {
      return speaking;
    },
    speak(text) {
      if (!prefs.enabled || !hasTts) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = prefs.rate;
      const voice = pick();
      if (voice) u.voice = voice;
      u.onstart = () => set(true);
      u.onend = u.onerror = () => set(false);
      speechSynthesis.speak(u);
    },
    stop() {
      if (hasTts) speechSynthesis.cancel();
      speaking = false;
    },
    // iOS permette la sintesi vocale solo dopo un gesto dell'utente: la si "sblocca" al primo tocco.
    unlock() {
      if (unlocked || !hasTts) return;
      unlocked = true;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      speechSynthesis.speak(u);
    },
    save(patch) {
      Object.assign(prefs, patch);
      store.set("speak", prefs.enabled ? "on" : "off");
      store.set("voice", prefs.voice);
      store.set("rate", String(prefs.rate));
      if (!prefs.enabled) this.stop();
      onChange();
    },
    onVoicesChanged(fn) {
      if (hasTts) speechSynthesis.addEventListener?.("voiceschanged", fn);
    },
  };
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);

// Ascolta una frase. onText riceve la trascrizione parziale; onDone quella finale (anche vuota).
export function listen({ onText, onDone, onError }) {
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  let finalText = "";
  let interimText = "";

  recognition.onresult = (e) => {
    finalText = "";
    interimText = "";
    for (const r of e.results) {
      if (r.isFinal) finalText += r[0].transcript;
      else interimText += r[0].transcript;
    }
    onText(finalText + interimText);
  };
  recognition.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") onError("Consenti il microfono in Impostazioni › Safari › Microfono.");
  };
  recognition.onend = () => onDone((finalText || interimText).trim());
  recognition.start();
  return recognition;
}
