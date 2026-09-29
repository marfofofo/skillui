import { z } from "zod";
import { defineTool, ToolError, truncate } from "./types.js";

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export const WebFetchTool = defineTool({
  name: "WebFetch",
  description: "Fetch a URL and return its content as plain text (HTML is stripped). Use for docs, issues and API references.",
  schema: z.object({ url: z.url() }),
  readOnly: true,
  summarize: (i) => i.url,
  ruleContent: (i) => `domain:${new URL(i.url).hostname}`,
  async run(input, ctx) {
    const res = await fetch(input.url, {
      signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(30_000)]),
      headers: { "user-agent": "codeforge/0.1" },
    });
    if (!res.ok) throw new ToolError(`HTTP ${res.status} ${res.statusText}`);
    const type = res.headers.get("content-type") ?? "";
    const body = await res.text();
    return truncate(type.includes("html") ? htmlToText(body) : body, 50_000);
  },
});

export const TodoWriteTool = defineTool({
  name: "TodoWrite",
  description:
    "Create or replace the task list for the current work. Use it for multi-step tasks: " +
    "keep exactly one item in_progress and mark items completed as soon as they are done.",
  schema: z.object({
    todos: z.array(
      z.object({
        content: z.string(),
        status: z.enum(["pending", "in_progress", "completed"]),
      }),
    ),
  }),
  readOnly: true,
  summarize: (i) => `${i.todos.filter((t) => t.status === "completed").length}/${i.todos.length} done`,
  async run(input, ctx) {
    ctx.todos.splice(0, ctx.todos.length, ...input.todos);
    const mark = { pending: "[ ]", in_progress: "[~]", completed: "[x]" } as const;
    return "Todos updated:\n" + input.todos.map((t) => `${mark[t.status]} ${t.content}`).join("\n");
  },
});

export const TaskTool = defineTool({
  name: "Task",
  description:
    "Launch a subagent with a fresh context to handle a self-contained task (broad codebase searches, " +
    "research, multi-step investigations). It has the same tools except Task, and returns one final report. " +
    "Give it a complete, standalone prompt: it cannot see this conversation. Several Task calls in one turn run in parallel.",
  schema: z.object({
    description: z.string().describe("3-5 word label"),
    prompt: z.string().describe("Full instructions for the subagent"),
  }),
  readOnly: true,
  summarize: (i) => i.description,
  async run(input, ctx) {
    if (!ctx.runSubagent) throw new ToolError("Subagents are not available here.");
    return ctx.runSubagent(input.description, input.prompt, ctx.signal);
  },
});

export const SkillTool = defineTool({
  name: "Skill",
  description: "Load the full instructions of a skill listed in the system prompt, then follow them.",
  schema: z.object({ name: z.string() }),
  readOnly: true,
  summarize: (i) => i.name,
  async run(input, ctx) {
    const body = ctx.loadSkill?.(input.name);
    if (body === undefined) throw new ToolError(`Unknown skill: ${input.name}`);
    return body;
  },
});
