// Icone in stile simboli di sistema e descrizione degli strumenti mostrati sul telefono.

export const ICON = {
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
export const QA_ICONS = ["play", "viewfinder", "moon", "laptop", "sparkles", "globe", "bulb", "mail", "speaker", "terminal"];

export const TOOLS = {
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

export const svg = (name, cls = "") => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICON[name] || ICON.sparkles}</svg>`;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
