// Motore "api" (opzionale): chiama direttamente la Claude API con ANTHROPIC_API_KEY.
// Stessa interfaccia del motore Claude Code: run / cancel / reset / busy.

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { SYSTEM_PROMPT, personalInstructions } from "../prompt.js";
import { executeTool, toolDefinitions } from "../tools.js";

const MAX_STEPS = 25;
const MAX_EXCHANGES = 12;

// Breakpoint di cache sull'ultimo strumento e sul prompt fisso; le istruzioni personali vanno dopo.
const tools = toolDefinitions.map((t, i) =>
  i === toolDefinitions.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t,
);

function systemBlocks(instructions) {
  const blocks = [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }];
  const extra = personalInstructions(instructions);
  if (extra) blocks.push({ type: "text", text: extra });
  return blocks;
}

export class ApiEngine {
  name = "Claude API";

  constructor() {
    this.client = new Anthropic();
    this.model = config.model || "claude-opus-5";
    this.messages = [];
    this.turnStarts = [];
    this.controller = null;
  }

  async start() {}

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

  async run(text, io, settings) {
    if (this.busy) throw new Error("Sto già lavorando a un comando");
    this.trimHistory();

    const checkpoint = this.messages.length;
    this.turnStarts.push(checkpoint);
    this.messages.push({ role: "user", content: text });
    this.controller = new AbortController();

    try {
      return await this.loop(io, this.controller.signal, settings);
    } catch (err) {
      // Riporta la cronologia a prima del comando, così non resta un turno a metà.
      this.messages.length = checkpoint;
      this.turnStarts.pop();
      throw err;
    } finally {
      this.controller = null;
    }
  }

  async loop(io, signal, settings) {
    for (let step = 0; step < MAX_STEPS; step++) {
      const params = {
        model: this.model,
        max_tokens: 16000,
        system: systemBlocks(settings.instructions),
        tools,
        thinking: { type: "adaptive" },
        output_config: { effort: settings.effort },
        messages: this.messages,
      };
      if (config.fallbacks) {
        params.betas = ["server-side-fallback-2026-07-01"];
        params.fallbacks = "default";
      }

      // Gli input degli strumenti sono piccoli: restano bufferizzati (e validati dal server);
      // in streaming arriva solo il testo, che i dispositivi mostrano mentre viene scritto.
      io.step();
      const stream = this.client.beta.messages.stream(params, { signal });
      stream.on("text", (delta) => io.delta(delta));
      const response = await stream.finalMessage();
      this.messages.push({ role: "assistant", content: response.content });

      const said = response.content
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
          return said || "Mi dispiace, non posso aiutarti con questa richiesta.";
        case "max_tokens":
          return said || "La risposta era troppo lunga, riprova con una richiesta più semplice.";
        default:
          return said || "Fatto.";
      }

      if (said) io.status(said);

      const results = [];
      for (const call of response.content.filter((b) => b.type === "tool_use")) {
        const r = await executeTool(call.name, call.input, { io, autoApprove: settings.autoApprove, signal });
        results.push({ type: "tool_result", tool_use_id: call.id, is_error: r.isError, content: r.content });
      }
      this.messages.push({ role: "user", content: results });
    }
    return "Mi sono fermato: il compito richiedeva troppi passaggi.";
  }

  // Tiene solo gli ultimi scambi, tagliando sempre all'inizio di un comando dell'utente.
  trimHistory() {
    if (this.turnStarts.length < MAX_EXCHANGES) return;
    const cut = this.turnStarts[this.turnStarts.length - MAX_EXCHANGES + 1];
    this.messages = this.messages.slice(cut);
    this.turnStarts = this.turnStarts.slice(-MAX_EXCHANGES + 1).map((i) => i - cut);
  }

  describeError(err) {
    if (err instanceof Anthropic.AuthenticationError) return "Chiave API di Anthropic non valida: controlla il file .env sul Mac.";
    if (err instanceof Anthropic.RateLimitError) return "Troppe richieste, riprova tra poco.";
    if (err instanceof Anthropic.APIConnectionError) return "Il Mac non riesce a raggiungere Claude: controlla la connessione.";
    if (err instanceof Anthropic.APIError) return `Errore dell'API (${err.status}): ${err.message}`;
    return err?.message || String(err);
  }
}
