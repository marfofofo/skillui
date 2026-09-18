// IDLE — an invite link that survives the sign-in it triggers.
//
// Someone taps idle.app/i/K4M7QX29 without an account. They are sent to sign in,
// and on web the magic link RELOADS the page, so anything held in memory is gone
// by the time they come back. The code therefore has to outlive the reload.

const KEY = "idle.pending_invite";

let inMemory: string | null = null;

const webStore = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    // Private windows and blocked site data both throw here.
    return null;
  }
};

export function rememberInvite(code: string) {
  inMemory = code;
  webStore()?.setItem(KEY, code);
}

export function takeInvite(): string | null {
  const code = inMemory ?? webStore()?.getItem(KEY) ?? null;
  inMemory = null;
  webStore()?.removeItem(KEY);
  return code;
}

export function peekInvite(): string | null {
  return inMemory ?? webStore()?.getItem(KEY) ?? null;
}
