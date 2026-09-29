import chalk from "chalk";

export interface Renderer {
  text(delta: string): void;
  thinking(delta: string): void;
  blockEnd(): void;
  toolStart(name: string, summary: string): void;
  toolResult(name: string, result: string, isError: boolean): void;
  info(message: string): void;
  error(message: string): void;
}

function preview(result: string, lines = 4): string {
  const all = result.split("\n");
  const shown = all.slice(0, lines).map((l) => (l.length > 160 ? l.slice(0, 160) + "…" : l));
  if (all.length > lines) shown.push(`… +${all.length - lines} lines`);
  return shown.join("\n");
}

const indent = (s: string, pad: string) => s.replace(/^/gm, pad);

/** Assistant text goes to stdout; everything else goes to stderr so `-p` output stays clean. */
export class TerminalRenderer implements Renderer {
  private inBlock: "text" | "thinking" | undefined;

  constructor(private verbose = false) {}

  private end() {
    if (this.inBlock) process[this.inBlock === "text" ? "stdout" : "stderr"].write("\n");
    this.inBlock = undefined;
  }

  text(delta: string) {
    if (this.inBlock !== "text") {
      this.end();
      process.stdout.write(chalk.white("● "));
      this.inBlock = "text";
    }
    process.stdout.write(delta);
  }

  thinking(delta: string) {
    if (this.inBlock !== "thinking") {
      this.end();
      process.stderr.write(chalk.dim.italic("✻ "));
      this.inBlock = "thinking";
    }
    process.stderr.write(chalk.dim.italic(delta));
  }

  blockEnd() {
    this.end();
  }

  toolStart(name: string, summary: string) {
    this.end();
    const s = summary.length > 200 ? summary.slice(0, 200) + "…" : summary;
    process.stderr.write(`${chalk.green("⏺")} ${chalk.bold(name)}${chalk.dim("(")}${s}${chalk.dim(")")}\n`);
  }

  toolResult(_name: string, result: string, isError: boolean) {
    const body = this.verbose ? result : preview(result);
    process.stderr.write((isError ? chalk.red : chalk.dim)(indent(body, "  ⎿ ")) + "\n");
  }

  info(message: string) {
    this.end();
    process.stderr.write(chalk.dim(message) + "\n");
  }

  error(message: string) {
    this.end();
    process.stderr.write(chalk.red(message) + "\n");
  }
}

/** Subagents show only their tool calls, indented under the Task call. */
export class SubagentRenderer implements Renderer {
  constructor(private label: string) {}
  text() {}
  thinking() {}
  blockEnd() {}
  toolStart(name: string, summary: string) {
    const s = summary.length > 120 ? summary.slice(0, 120) + "…" : summary;
    process.stderr.write(chalk.dim(`  │ [${this.label}] ${name}(${s})\n`));
  }
  toolResult(_n: string, _r: string, isError: boolean) {
    if (isError) process.stderr.write(chalk.dim.red(`  │ [${this.label}] error\n`));
  }
  info() {}
  error(message: string) {
    process.stderr.write(chalk.red(`  │ [${this.label}] ${message}\n`));
  }
}

export class SilentRenderer implements Renderer {
  text() {}
  thinking() {}
  blockEnd() {}
  toolStart() {}
  toolResult() {}
  info() {}
  error() {}
}
