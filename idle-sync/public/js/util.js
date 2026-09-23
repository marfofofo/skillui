// Piccole utilità condivise dai moduli della web app.

export const $ = (id) => document.getElementById(id);

// localStorage può mancare (navigazione privata, anteprime): ogni accesso è protetto.
export const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  },
};

export function guessDeviceName() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Macintosh/.test(ua)) return "Mac";
  return "Browser";
}

let toastTimer = null;
export function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2800);
}

export function paintRange(el) {
  const min = Number(el.min);
  const max = Number(el.max);
  el.style.setProperty("--p", `${((Number(el.value) - min) / (max - min)) * 100}%`);
}
