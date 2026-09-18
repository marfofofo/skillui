// "IDLE" — the only two requests this package ever makes.

import { API_URL, CLIENT, REQUEST_TIMEOUT_MS } from "./constants.js";

async function post(path, { body, token }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": CLIENT,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

export function pair({ code, label, agent }) {
  return post("/pair", { body: { code, label, agent } });
}

export function heartbeat({ token, payload }) {
  return post("/heartbeat", { body: payload, token });
}
