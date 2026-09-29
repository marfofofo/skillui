# codeforge

An agentic coding CLI built on the Claude API, with the same architecture as Claude Code: a streaming tool-use loop, file/shell/search tools, permission modes and rules, hooks, project memory, skills, custom slash commands, subagents, MCP servers, persistent sessions and context compaction.

```bash
cd codeforge
npm install && npm run build && npm link   # installs the `codeforge` command
export ANTHROPIC_API_KEY=sk-ant-...
codeforge                                  # interactive
codeforge -p "why does the build fail?"    # one-shot
```

## Architecture

```
src/
  index.ts        CLI entry: args, REPL, Ctrl+C handling, print mode, wiring
  agent.ts        The agentic loop (see below)
  tools/          Built-in tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch, TodoWrite, Task, Skill
  permissions.ts  Permission modes + allow/deny rules, interactive approval
  hooks.ts        PreToolUse / PostToolUse / UserPromptSubmit / Stop shell hooks
  context.ts      System prompt, memory files (CODEFORGE.md / AGENTS.md / CLAUDE.md), skills, custom commands
  mcp.ts          MCP client (stdio + streamable HTTP); MCP tools become mcp__<server>__<tool>
  session.ts      Transcripts saved under ~/.codeforge/projects/<cwd>/, for --continue / --resume
  commands.ts     Slash commands
  ui.ts           Terminal rendering (text on stdout, everything else on stderr)
```

**The loop** (`Agent.send`): push the user message, then repeat: stream a model turn (text and summarized thinking render live) → if it stops for `tool_use`, validate each input against its schema, check permissions, run PreToolUse hooks, execute (read-only calls in parallel, others in order), run PostToolUse hooks, and return every `tool_result` in one user message → continue until the model ends its turn. It also handles `pause_turn` (server web search), `refusal`, truncated tool calls at `max_tokens` (never executed), and user interrupts: every `tool_use` always gets a `tool_result`, so the history stays valid.

**API usage**: `client.beta.messages.stream` with adaptive thinking, `output_config.effort`, top-level auto prompt caching (the conversation prefix is cached every turn), `eager_input_streaming` on tools, the hosted `web_search` tool, and server-side refusal fallbacks (`fallbacks: "default"`; turn off with `"fallbacks": false`). Default model: `claude-opus-5-5`.

**Subagents**: the `Task` tool starts a fresh `Agent` with every tool except `Task`, and returns only its final report, which keeps the main context small. Several Task calls in one turn run in parallel.

**Compaction**: `/compact` (or automatically past `autoCompactTokens`) asks the model for a structured summary using the same cached prefix, then replaces the history with it.

## Configuration

Settings are merged from `~/.codeforge/settings.json`, `.codeforge/settings.json` and `.codeforge/settings.local.json`:

```json
{
  "model": "claude-opus-5-5",
  "effort": "high",
  "permissions": {
    "defaultMode": "default",
    "allow": ["Bash(npm test:*)", "Bash(git status)", "Edit(src/**)", "WebFetch(domain:docs.python.org)"],
    "deny": ["Bash(git push:*)", "Read(.env)"]
  },
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit|Write", "command": "npx prettier --write \"$(jq -r .tool_input.file_path)\"" }]
  },
  "mcpServers": {
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] },
    "remote": { "url": "https://example.com/mcp" }
  }
}
```

- **Permission modes**: `default` (ask before edits and commands), `acceptEdits` (edits inside the project run without asking), `plan` (read-only), `bypassPermissions`. Switch modes with `/mode`.
- **Rules**: `Tool` or `Tool(pattern)`. `prefix:*` matches a command prefix; `*`/`**` are globs. A Bash allow rule approves a chained command (`a && b`) only if every part matches it. Commands that use `$(...)` or backticks are never auto-approved.
- **Hooks** get a JSON payload on stdin. Exit code 2 blocks the action and sends stderr back to the model.
- **Memory**: `~/.codeforge/CODEFORGE.md`, then `CODEFORGE.md` / `AGENTS.md` / `CLAUDE.md` from the filesystem root down to the working directory. A line `@path` inlines another file. `/init` writes one for you.
- **Skills**: `.codeforge/skills/<name>/SKILL.md`, with `name` and `description` frontmatter. Only the descriptions go in the prompt; the model loads a skill's full text with the Skill tool.
- **Custom commands**: `.codeforge/commands/<name>.md` becomes `/<name>`, and `$ARGUMENTS` is replaced with the text after the command.

## Development

```bash
npm run dev       # run from source with tsx
npm run typecheck
npm test          # tools, permissions, the agent loop (with a fake stream), hooks, MCP
```
