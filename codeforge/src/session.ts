import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { HOME_DIR } from "./config.js";

export interface SessionFile {
  id: string;
  cwd: string;
  model: string;
  created: string;
  updated: string;
  title: string;
  messages: Anthropic.Beta.BetaMessageParam[];
}

function projectDir(cwd: string): string {
  return path.join(HOME_DIR, "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"));
}

export class SessionStore {
  readonly id: string;
  private created = new Date().toISOString();
  private title = "";

  constructor(private cwd: string, id?: string) {
    this.id = id ?? crypto.randomUUID();
  }

  save(model: string, messages: Anthropic.Beta.BetaMessageParam[]) {
    if (messages.length === 0) return;
    if (!this.title) {
      const first = messages[0].content;
      const text = typeof first === "string" ? first : first.find((b) => b.type === "text")?.text ?? "";
      this.title = text.replace(/\s+/g, " ").slice(0, 80);
    }
    const data: SessionFile = {
      id: this.id,
      cwd: this.cwd,
      model,
      created: this.created,
      updated: new Date().toISOString(),
      title: this.title,
      messages,
    };
    const dir = projectDir(this.cwd);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${this.id}.json`);
    fs.writeFileSync(file + ".tmp", JSON.stringify(data));
    fs.renameSync(file + ".tmp", file);
  }

  static list(cwd: string): SessionFile[] {
    const dir = projectDir(cwd);
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    return files
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as SessionFile;
        } catch {
          return undefined;
        }
      })
      .filter((s): s is SessionFile => !!s)
      .sort((a, b) => b.updated.localeCompare(a.updated));
  }

  static load(cwd: string, id?: string): { store: SessionStore; session: SessionFile } | undefined {
    const sessions = SessionStore.list(cwd);
    const session = id ? sessions.find((s) => s.id.startsWith(id)) : sessions[0];
    if (!session) return undefined;
    const store = new SessionStore(cwd, session.id);
    store.created = session.created;
    store.title = session.title;
    return { store, session };
  }
}
