import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { join } from "node:path";
import type { WorldEvent } from "@pumpworld/protocol";

/** Append-only JSONL event log. One line per event. */
export class EventLog {
  private stream: WriteStream;
  constructor(public readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.stream = createWriteStream(path, { flags: "a" });
  }
  append(events: WorldEvent[]): void {
    if (events.length === 0) return;
    const buf = events.map(e => JSON.stringify(e)).join("\n") + "\n";
    this.stream.write(buf);
  }
  async close(): Promise<void> {
    return new Promise(res => this.stream.end(() => res()));
  }
}

export function newRunDir(root: string, seed: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(root, `${stamp}__${seed}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(0, i) : ".";
}
