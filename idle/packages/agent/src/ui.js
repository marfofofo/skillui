// "IDLE" — the design system, in a terminal.
// INK and PAPER are the terminal's own; SIGNAL is ours and means one thing.

const useColor =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  process.stdout.isTTY;

const wrap = (code) => (s) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);

export const bold = wrap("1");
export const dim = wrap("2");
export const inverse = wrap("7");
/** SIGNAL #FF3B00 — reserved for live presence. Nothing else may use it. */
export const signal = wrap("38;2;255;59;0");
export const concrete = wrap("38;2;138;135;130");

export const WORDMARK = bold('"IDLE"');

/** A meta-label: the smallest type on screen, naming what a thing literally is. */
export function meta(label) {
  return concrete(`"${label.toUpperCase()}"`);
}

export function say(...parts) {
  process.stdout.write(parts.join(" ") + "\n");
}

export function blank() {
  process.stdout.write("\n");
}

export function rule(width = 46) {
  say(concrete("─".repeat(width)));
}

/** MARCUS          c/o   CLAUDE CODE */
export function presenceLine(handle, agentLabel) {
  const name = bold(handle.toUpperCase().padEnd(16));
  return `${name}${concrete("c/o")}   ${agentLabel ? signal(agentLabel) : concrete("—")}`;
}

export function fail(message) {
  process.stderr.write(`${bold("×")} ${message}\n`);
}
