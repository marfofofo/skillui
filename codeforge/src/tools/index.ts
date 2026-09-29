import { BashTool } from "./bash.js";
import { EditTool, ReadTool, WriteTool } from "./files.js";
import { SkillTool, TaskTool, TodoWriteTool, WebFetchTool } from "./misc.js";
import { GlobTool, GrepTool } from "./search.js";
import type { Tool } from "./types.js";

export function builtinTools(): Tool[] {
  return [BashTool, ReadTool, WriteTool, EditTool, GlobTool, GrepTool, WebFetchTool, TodoWriteTool, TaskTool, SkillTool];
}

export type { Tool, ToolContext, Todo } from "./types.js";
