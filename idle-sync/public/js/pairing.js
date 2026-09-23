// Schermata di abbinamento: il codice a 6 cifre mostrato sul Mac (o nel QR) diventa un token personale.

import { $, guessDeviceName, store } from "./util.js";

export function readToken() {
  const fromUrl = new URLSearchParams(location.search).get("t");
  if (fromUrl) store.set("token", fromUrl);
  return fromUrl || store.get("token");
}

export function forgetToken() {
  store.set("token", null);
  history.replaceState(null, "", "/");
}

export function showPairing(onPaired) {
  const page = $("pairing");
  const form = $("pairForm");
  const codeInput = $("pairCode");
  const nameInput = $("pairName");
  const error = $("pairError");
  const button = form.querySelector("button[type=submit]");

  page.hidden = false;
  nameInput.value = store.get("device") || guessDeviceName();

  // Il QR porta il codice nell'indirizzo (#code=123456): lo si compila da solo.
  const fromHash = new URLSearchParams(location.hash.slice(1)).get("code");
  codeInput.value = fromHash || "";
  error.textContent = "";

  codeInput.oninput = () => {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    error.textContent = "";
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const code = codeInput.value.trim();
    if (code.length !== 6) {
      error.textContent = "Il codice ha 6 cifre.";
      return;
    }
    button.disabled = true;
    error.textContent = "";
    try {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: nameInput.value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Abbinamento non riuscito.");
      store.set("token", data.token);
      store.set("device", data.device.name);
      // Il token resta nell'indirizzo: così "Aggiungi alla schermata Home" lo conserva
      // (su iOS l'app dalla Home non condivide i dati di Safari).
      history.replaceState(null, "", `/?t=${encodeURIComponent(data.token)}`);
      page.hidden = true;
      onPaired(data.token);
    } catch (err) {
      error.textContent = err.message === "Failed to fetch" ? "Mac non raggiungibile." : err.message;
      codeInput.select();
    } finally {
      button.disabled = false;
    }
  };

  if (fromHash && fromHash.length === 6) form.requestSubmit();
  else codeInput.focus();
}
