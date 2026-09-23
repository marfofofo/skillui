// Il "cervello": riceve un comando (voce trascritta o testo), fa ragionare Claude,
// esegue gli strumenti sul Mac e restituisce una risposta breve da leggere ad alta voce.
// v2: risposte in streaming e impostazioni (effort, conferme, istruzioni) applicate a ogni comando.

import os from "node:os";
import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, getTool, describeToolCall } from "./tools.js";

const MODEL = process.env.MODEL || "claude-opus-5";
const FALLBACKS = process.env.FALLBACKS !== "off";
const MAX_STEPS = 25;
const MAX_EXCHANGES = 12;

const client = new Anthropic();

const SYSTEM_PROMPT = `Sei IDLE SYNC, l'assistente vocale personale dell'utente, e controlli il suo Mac ("${os.hostname()}") tramite gli strumenti a disposizione.
L'utente ti parla da un iPhone o da un altro dispositivo usato come telecomando: non vede lo schermo del Mac mentre parla, e le tue risposte vengono lette ad alta voce.

Come comportarti:
- Rispondi nella lingua dell'utente (di solito italiano).
- Risposte brevissime e parlate: una o due frasi, niente markdown, elenchi, emoji o URL lunghi.
- Quando ti viene chiesto di fare qualcosa, fallo direttamente con gli strumenti invece di spiegare come si fa. Poi conferma in poche parole cosa hai fatto.
- Se non sai cosa c'è sullo schermo e ti serve saperlo, usa take_screenshot o get_status.
- Preferisci gli strumenti specifici; usa run_applescript o run_shell solo quando servono davvero.
- Per luci, accessori di Casa e altri dispositivi usa i Comandi Rapidi (list_shortcuts / run_shortcut).
- Prima di azioni irreversibili o verso altre persone (cancellare file, inviare messaggi o email, acquisti) chiedi conferma all'utente, a meno che non te l'abbia già chiesto esplicitamente.
- Se una richiesta è ambigua, fai una sola domanda breve.`;

// Il breakpoint sull'ultimo strumento mette in cache gli strumenti; quello sul prompt di sistema fisso
// mette in cache anche il prompt. Le istruzioni personali vanno dopo, perché possono cambiare.
const tools = toolDefinitions.map((t, i) =>
  i === toolDefinitions.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t,
);

export const EFFORTS = ["low", "medium", "high"];

function systemBlocks(instructions) {
  const blocks = [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }];
  const extra = (instructions || "").trim();
  if (extra) blocks.push({ type: "text", text: `Preferenze e istruzioni personali dell'utente:\n${extra}` });
  return blocks;
}

export class Session {
  constructor() {
    this.messages = [];
    this.turnStarts = [];
    this.controller = null;
  }

  get busy() {
    return this.controller !== null;
  }

  reset() {
    this.cancel();
    this.messages = [];
    this.turnStarts = [];
  }

  cancel() {
    this.controller?.abort();
  }

  // io: { step(), delta(text), status(text), tool(name, detail), approve(name, detail) => Promise<boolean> }
  // options: { effort, autoApprove, instructions }
  async run(text, io, options = {}) {
    if (this.busy) throw new Error("Sto già lavorando a un comando");
    this.trimHistory();

    const checkpoint = this.messages.length;
    this.turnStarts.push(checkpoint);
    this.messages.push({ role: "user", content: text });
    this.controller = new AbortController();

    try {
      return await this.loop(io, this.controller.signal, options);
    } catch (err) {
      // Riporta la cronologia a prima del comando, così non resta un turno a metà.
      this.messages.length = checkpoint;
      this.turnStarts.pop();
      throw err;
    } finally {
      this.controller = null;
    }
  }

  async loop(io, signal, options) {
    const effort = EFFORTS.includes(options.effort) ? options.effort : "low";
    for (let step = 0; step < MAX_STEPS; step++) {
      const params = {
        model: MODEL,
        max_tokens: 16000,
        system: systemBlocks(options.instructions),
        tools,
        thinking: { type: "adaptive" },
        output_config: { effort },
        messages: this.messages,
      };
      if (FALLBACKS) {
        params.betas = ["server-side-fallback-2026-07-01"];
        params.fallbacks = "default";
      }

      // Gli input degli strumenti sono piccoli: restano bufferizzati (e validati dal server);
      // in streaming arriva solo il testo, che il telefono mostra mentre viene scritto.
      io.step();
      const stream = client.beta.messages.stream(params, { signal });
      stream.on("text", (delta) => io.delta(delta));
      const response = await stream.finalMessage();
      this.messages.push({ role: "assistant", content: response.content });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();

      switch (response.stop_reason) {
        case "tool_use":
          break;
        case "pause_turn":
          continue;
        case "refusal":
          return text || "Mi dispiace, non posso aiutarti con questa richiesta.";
        case "max_tokens":
          return text || "La risposta era troppo lunga, riprova con una richiesta più semplice.";
        default:
          return text || "Fatto.";
      }

      if (text) io.status(text);

      const results = [];
      for (const call of response.content.filter((b) => b.type === "tool_use")) {
        results.push(await this.executeTool(call, io, signal, options));
      }
      this.messages.push({ role: "user", content: results });
    }
    return "Mi sono fermato: il compito richiedeva troppi passaggi.";
  }

  async executeTool(call, io, signal, options) {
    const tool = getTool(call.name);
    const input = call.input ?? {};
    const detail = describeToolCall(call.name, input);

    if (!tool) {
      return { type: "tool_result", tool_use_id: call.id, is_error: true, content: `Strumento sconosciuto: ${call.name}` };
    }

    if (tool.needsApproval && !options.autoApprove) {
      const ok = await io.approve(call.name, detail);
      if (signal.aborted) throw new Error("Annullato");
      if (!ok) {
        return {
          type: "tool_result",
          tool_use_id: call.id,
          is_error: true,
          content: "L'utente ha rifiutato questa azione.",
        };
      }
    }

    io.tool(call.name, detail);
    try {
      const content = await tool.run(input);
      return { type: "tool_result", tool_use_id: call.id, content };
    } catch (err) {
      return { type: "tool_result", tool_use_id: call.id, is_error: true, content: `Errore: ${err.message}` };
    }
  }

  // Tiene solo gli ultimi scambi, tagliando sempre all'inizio di un comando dell'utente.
  trimHistory() {
    if (this.turnStarts.length < MAX_EXCHANGES) return;
    const cut = this.turnStarts[this.turnStarts.length - MAX_EXCHANGES + 1];
    this.messages = this.messages.slice(cut);
    this.turnStarts = this.turnStarts.slice(-MAX_EXCHANGES + 1).map((i) => i - cut);
  }
}

export function isAbort(err) {
  return err instanceof Anthropic.APIUserAbortError || err?.name === "AbortError" || err?.message === "Annullato";
}

export function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "Chiave API di Anthropic non valida: controlla il file .env sul Mac.";
  if (err instanceof Anthropic.RateLimitError) return "Troppe richieste, riprova tra poco.";
  if (err instanceof Anthropic.APIConnectionError) return "Il Mac non riesce a raggiungere Claude: controlla la connessione.";
  if (err instanceof Anthropic.APIError) return `Errore dell'API (${err.status}): ${err.message}`;
  return err?.message || String(err);
}
