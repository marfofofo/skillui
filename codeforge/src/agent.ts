import Anthropic from "@anthropic-ai/sdk";
import type { Effort } from "./config.js";
import type { Hooks } from "./hooks.js";
import type { Permissions } from "./permissions.js";
import { ToolError, type Tool, type ToolContext } from "./tools/types.js";
import type { Renderer } from "./ui.js";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type Message = Anthropic.Beta.BetaMessage;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;
export type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];

/** The slice of the SDK's BetaMessageStream the loop uses; tests pass a fake. */
export interface StreamLike {
  on(event: "streamEvent", listener: (event: Anthropic.Beta.BetaRawMessageStreamEvent) => void): unknown;
  finalMessage(): Promise<Message>;
}
export type StreamFn = (params: StreamParams, options: { signal: AbortSignal }) => StreamLike;

export interface AgentOptions {
  stream: StreamFn;
  model: string;
  effort: Effort;
  maxTokens: number;
  system: string;
  tools: Tool[];
  permissions: Permissions;
  hooks?: Hooks;
  renderer: Renderer;
  fallbacks: boolean;
  webSearch: boolean;
  autoCompactTokens: number;
  context: Omit<ToolContext, "signal">;
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export class InterruptedError extends Error {
  constructor() {
    super("Interrupted by user");
  }
}

const MAX_JSON_RETRIES = 2;

const COMPACT_PROMPT = `Stop here and do not call any tools. Write a detailed summary of this conversation so that work can continue in a fresh context. Include:
1. The user's requests and intent, quoted where precise wording matters.
2. Key technical decisions and concepts.
3. Files examined or changed, with the important snippets and why they matter.
4. Errors hit and how they were fixed.
5. Current state: what is done, what is pending, and the exact next step.`;

export class Agent {
  messages: MessageParam[] = [];
  usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  /** Prompt size of the most recent request, used to trigger auto-compaction. */
  contextTokens = 0;

  constructor(public opts: AgentOptions) {}

  private apiTools(): StreamParams["tools"] {
    const tools: NonNullable<StreamParams["tools"]> = this.opts.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
      eager_input_streaming: true,
    }));
    if (this.opts.webSearch) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 5 });
    return tools;
  }

  private params(messages: MessageParam[]): StreamParams {
    const params: StreamParams = {
      model: this.opts.model,
      max_tokens: this.opts.maxTokens,
      system: [{ type: "text", text: this.opts.system }],
      tools: this.apiTools(),
      messages,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: this.opts.effort },
      // Auto-caching: the conversation prefix is cached on every turn.
      cache_control: { type: "ephemeral" },
    };
    if (this.opts.fallbacks) {
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }
    return params;
  }

  private recordUsage(m: Message) {
    const u = m.usage;
    this.usage.input += u.input_tokens;
    this.usage.output += u.output_tokens;
    this.usage.cacheRead += u.cache_read_input_tokens ?? 0;
    this.usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
    this.contextTokens = u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + u.output_tokens;
  }

  /** Streams one model turn to the renderer and returns the complete message. */
  private async turn(messages: MessageParam[], signal: AbortSignal, render = true): Promise<Message> {
    const r = this.opts.renderer;
    for (let attempt = 0; ; attempt++) {
      const stream = this.opts.stream(this.params(messages), { signal });
      if (render) {
        stream.on("streamEvent", (e) => {
          if (e.type === "content_block_delta") {
            if (e.delta.type === "text_delta") r.text(e.delta.text);
            else if (e.delta.type === "thinking_delta") r.thinking(e.delta.thinking);
          } else if (e.type === "content_block_start" && e.content_block.type === "server_tool_use") {
            r.toolStart("WebSearch", "…");
          } else if (e.type === "content_block_stop") {
            r.blockEnd();
          }
        });
      }
      try {
        const message = await stream.finalMessage();
        this.recordUsage(message);
        return message;
      } catch (err) {
        if (signal.aborted) throw new InterruptedError();
        // With eager input streaming, unparseable tool JSON rejects here. Retry only that; rethrow everything else.
        // The SDK has no dedicated class for this error, so it is identified by its message.
        const badJson =
          err instanceof Anthropic.AnthropicError &&
          !(err instanceof Anthropic.APIError) &&
          err.message.startsWith("Unable to parse tool parameter JSON");
        if (!badJson || attempt >= MAX_JSON_RETRIES) throw err;
        r.error("Tool input was not valid JSON; retrying the turn.");
      }
    }
  }

  /** Sends a user prompt and runs the agentic loop until the model stops. Returns the final text. */
  async send(prompt: string | Anthropic.Beta.BetaContentBlockParam[], signal: AbortSignal): Promise<string> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = typeof prompt === "string" ? [{ type: "text", text: prompt }] : prompt;
    if (this.opts.hooks) {
      const text = content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
      const hook = await this.opts.hooks.run("UserPromptSubmit", { prompt: text });
      if (hook.blocked) {
        this.opts.renderer.error(`Prompt blocked by hook: ${hook.message}`);
        return "";
      }
      if (hook.message) content.push({ type: "text", text: `<hook-context>\n${hook.message}\n</hook-context>` });
    }
    this.messages.push({ role: "user", content });
    return this.loop(signal);
  }

  private async loop(signal: AbortSignal): Promise<string> {
    const r = this.opts.renderer;
    while (true) {
      if (this.contextTokens > this.opts.autoCompactTokens) {
        r.info(`Context at ${this.contextTokens} tokens; compacting…`);
        await this.compact(signal);
      }

      const message = await this.turn(this.messages, signal);
      const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");

      if (message.stop_reason === "refusal") {
        // Never run tools from a refused turn; it may have cut a tool_use off mid-input.
        const d = message.stop_details;
        r.error(`The model declined this request${d?.category ? ` (${d.category})` : ""}.${d?.explanation ? " " + d.explanation : ""}`);
        return text;
      }

      if (message.stop_reason === "pause_turn") {
        this.messages.push({ role: "assistant", content: message.content });
        continue;
      }

      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (toolUses.length > 0 && message.stop_reason === "max_tokens") {
        // A truncated tool input can still parse; do not run it.
        r.error("Output limit reached in the middle of a tool call. Raise maxTokens in settings, or ask for smaller steps.");
        return text;
      }

      this.messages.push({ role: "assistant", content: message.content });

      if (toolUses.length === 0) {
        if (message.stop_reason === "max_tokens") r.error("Response truncated: output token limit reached.");
        if (this.opts.hooks) {
          const hook = await this.opts.hooks.run("Stop", { last_message: text });
          if (hook.blocked) {
            this.messages.push({ role: "user", content: [{ type: "text", text: `Stop hook feedback:\n${hook.message}` }] });
            continue;
          }
        }
        return text;
      }

      const results = await this.runTools(toolUses, signal);
      this.messages.push({ role: "user", content: results });
      if (signal.aborted) throw new InterruptedError();
    }
  }

  private async runTools(calls: Anthropic.Beta.BetaToolUseBlock[], signal: AbortSignal): Promise<ToolResult[]> {
    const byName = new Map(this.opts.tools.map((t) => [t.name, t]));
    const allReadOnly = calls.every((c) => byName.get(c.name)?.readOnly);
    if (allReadOnly) return Promise.all(calls.map((c) => this.runTool(c, byName.get(c.name), signal)));
    const results: ToolResult[] = [];
    for (const call of calls) results.push(await this.runTool(call, byName.get(call.name), signal));
    return results;
  }

  /** Always returns a result, so every tool_use in the history gets its tool_result even on interrupt. */
  private async runTool(call: Anthropic.Beta.BetaToolUseBlock, tool: Tool | undefined, signal: AbortSignal): Promise<ToolResult> {
    try {
      return await this.runToolUnsafe(call, tool, signal);
    } catch (err) {
      const content = signal.aborted ? "Interrupted by user" : `Error: ${err instanceof Error ? err.message : String(err)}`;
      this.opts.renderer.toolResult(call.name, content, true);
      return { type: "tool_result", tool_use_id: call.id, is_error: true, content };
    }
  }

  private async runToolUnsafe(call: Anthropic.Beta.BetaToolUseBlock, tool: Tool | undefined, signal: AbortSignal): Promise<ToolResult> {
    const r = this.opts.renderer;
    const fail = (content: string): ToolResult => {
      r.toolResult(call.name, content, true);
      return { type: "tool_result", tool_use_id: call.id, is_error: true, content };
    };
    if (signal.aborted) return { type: "tool_result", tool_use_id: call.id, is_error: true, content: "Interrupted by user" };
    if (!tool) return fail(`Unknown tool: ${call.name}`);

    const parsed = tool.parse(call.input);
    if (!parsed.ok) {
      r.toolStart(tool.name, "invalid input");
      return fail(`Invalid input:\n${parsed.error}\nReceived: ${JSON.stringify(call.input).slice(0, 2000)}`);
    }
    const input = parsed.data;
    r.toolStart(tool.name, tool.summarize(input));

    const decision = await this.opts.permissions.check(tool, input);
    if (!decision.allow) return fail(decision.reason);

    if (this.opts.hooks) {
      const pre = await this.opts.hooks.run("PreToolUse", { tool_name: tool.name, tool_input: input });
      if (pre.blocked) return fail(`Blocked by PreToolUse hook: ${pre.message}`);
    }

    let output: string;
    try {
      output = await tool.run(input, { ...this.opts.context, signal });
    } catch (err) {
      if (signal.aborted) return fail("Interrupted by user");
      if (err instanceof ToolError) return fail(err.message);
      return fail(`${tool.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (this.opts.hooks) {
      const post = await this.opts.hooks.run("PostToolUse", { tool_name: tool.name, tool_input: input, tool_response: output });
      if (post.message) output += `\n\n<hook-feedback>\n${post.message}\n</hook-feedback>`;
    }
    r.toolResult(tool.name, output, false);
    return { type: "tool_result", tool_use_id: call.id, content: output || "(no output)" };
  }

  /**
   * Replaces the history with a model-written summary. The request reuses the same
   * tools and system prompt, so it reads the cached conversation prefix.
   */
  async compact(signal: AbortSignal, instructions?: string): Promise<void> {
    if (this.messages.length === 0) return;
    const prompt = COMPACT_PROMPT + (instructions ? `\n\nAdditional focus: ${instructions}` : "");
    const request: MessageParam[] = [...this.messages, { role: "user", content: [{ type: "text", text: prompt }] }];
    const message = await this.turn(request, signal, false);
    const summary = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    if (!summary.trim()) throw new Error("Compaction produced an empty summary");
    this.messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This session continues from an earlier conversation that was compacted. Summary:\n\n${summary}\n\nContinue from where it left off.`,
          },
        ],
      },
    ];
    this.contextTokens = 0;
  }

  clear() {
    this.messages = [];
    this.contextTokens = 0;
    this.opts.context.readFiles.clear();
    this.opts.context.todos.splice(0);
  }
}
