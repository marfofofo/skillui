import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export type JsonSchema = Anthropic.Beta.BetaTool.InputSchema;

export interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

/** Everything a tool may touch while it runs. One context per agent. */
export interface ToolContext {
  cwd: string;
  signal: AbortSignal;
  /** Absolute path -> mtimeMs at the time the agent last read it. Guards Edit/Write. */
  readFiles: Map<string, number>;
  todos: Todo[];
  /** Runs a subagent with a fresh context and returns its final report. */
  runSubagent?: (description: string, prompt: string, signal: AbortSignal) => Promise<string>;
  /** Loads a skill body by name. */
  loadSkill?: (name: string) => string | undefined;
}

export type ParseResult = { ok: true; data: unknown } | { ok: false; error: string };

export interface Tool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** Read-only tools run without asking and may run in parallel. */
  readOnly: boolean;
  parse(input: unknown): ParseResult;
  run(input: any, ctx: ToolContext): Promise<string>;
  /** One-line summary for the UI and the permission prompt. */
  summarize(input: any): string;
  /** The string permission rules match against, e.g. the bash command or file path. */
  ruleContent?(input: any): string | undefined;
}

export class ToolError extends Error {}

export function defineTool<S extends z.ZodObject<any>>(def: {
  name: string;
  description: string;
  schema: S;
  readOnly: boolean;
  run(input: z.infer<S>, ctx: ToolContext): Promise<string>;
  summarize(input: z.infer<S>): string;
  ruleContent?(input: z.infer<S>): string | undefined;
}): Tool {
  const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(def.schema) as Record<string, unknown>;
  return {
    name: def.name,
    description: def.description,
    inputSchema: inputSchema as JsonSchema,
    readOnly: def.readOnly,
    parse(input) {
      const r = def.schema.safeParse(input);
      return r.success ? { ok: true, data: r.data } : { ok: false, error: z.prettifyError(r.error) };
    },
    run: def.run,
    summarize: def.summarize,
    ruleContent: def.ruleContent,
  };
}

export function truncate(text: string, max = 30_000): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  return `${text.slice(0, half)}\n\n... [${text.length - max} characters truncated] ...\n\n${text.slice(-half)}`;
}
