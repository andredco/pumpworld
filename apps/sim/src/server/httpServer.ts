import { createReadStream, statSync, readdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join, resolve, basename } from "node:path";
import type { World } from "../world/World.js";
import { personalities } from "../world/seed.js";
import { config } from "../config.js";

/** Read-only inspector + replay API for the web UI. Call {@link Server.listen} after attaching WebSocket when sharing a port. */
export function createHttpServer(world: World): Server {
  const dataRoot = resolve(config.dataDir);
  const server = createServer((req, res) => {
    cors(res);
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const path = url.pathname;
    try {
      // --- live state ---
      if (path === "/healthz") return json(res, { ok: true, tick: world.meta.tick });
      if (path === "/snapshot") return json(res, world.snapshot());
      if (path === "/pills") return json(res, [...world.pills.values()]);
      if (path === "/pill") {
        const id = url.searchParams.get("id");
        if (!id) return error(res, 400, "missing id");
        const p = world.pills.get(id);
        if (!p) return error(res, 404, "not found");
        return json(res, { pill: p, personality: personalities.get(id) ?? null });
      }
      if (path === "/incidents") return json(res, [...world.incidents.values()]);
      if (path === "/trials") return json(res, [...world.trials.values()]);
      if (path === "/buildings") return json(res, [...world.buildings.values()]);
      if (path === "/items") return json(res, [...world.items.values()]);
      if (path === "/blogs") {
        const posts = [...world.blogPosts.values()].sort((a, b) => b.publishedAtTick - a.publishedAtTick);
        return json(res, posts);
      }
      if (path.startsWith("/blog/")) {
        const id = path.slice("/blog/".length);
        const p = world.blogPosts.get(id);
        if (!p) return error(res, 404, "not found");
        return json(res, p);
      }

      // --- recordings (replays) ---
      if (path === "/runs") return json(res, listRuns(dataRoot, world));
      if (path.startsWith("/run/")) return serveRunRoute(dataRoot, path, url, res);

      return error(res, 404, "unknown route");
    } catch (e) {
      return error(res, 500, (e as Error).message);
    }
  });
  return server;
}

/** Convenience: listen immediately (local dev). Prefer {@link createHttpServer} when sharing HTTP+WS on one port (Railway `PORT`). */
export function startHttpServer(port: number, world: World): Server {
  const server = createHttpServer(world);
  server.listen(port);
  return server;
}

interface RunSummary {
  id: string;
  startedAt: string;
  seed: string;
  isLive: boolean;
  eventBytes: number;
  snapshots: number[];
  lastEventTick: number | null;
}

function listRuns(dataRoot: string, world: World): RunSummary[] {
  let entries: string[] = [];
  try { entries = readdirSync(dataRoot); } catch { return []; }
  const liveDirName = currentLiveRunDirName(world);
  const out: RunSummary[] = [];
  for (const id of entries) {
    const dir = join(dataRoot, id);
    let stat;
    try { stat = statSync(dir); } catch { continue; }
    if (!stat.isDirectory()) continue;
    // parse id "YYYY-MM-DDTHH-MM-SS-mmmZ__seed"
    const [stamp, ...seedParts] = id.split("__");
    if (!stamp) continue;
    const seed = seedParts.join("__") || "";
    const startedAt = isoFromStamp(stamp);

    const eventsPath = join(dir, "events.jsonl");
    let eventBytes = 0;
    try { eventBytes = statSync(eventsPath).size; } catch { /* no events yet */ }

    const snapshots: number[] = [];
    try {
      for (const f of readdirSync(dir)) {
        const m = f.match(/^tick-(\d+)\.snapshot\.json$/);
        if (m) snapshots.push(Number(m[1]!));
      }
    } catch { /* */ }
    snapshots.sort((a, b) => a - b);

    out.push({
      id, startedAt, seed,
      isLive: id === liveDirName,
      eventBytes,
      snapshots,
      lastEventTick: null,
    });
  }
  // newest first
  out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return out;
}

function currentLiveRunDirName(world: World): string | null {
  // Sim tells httpServer no path; we mark a run as live if its seed matches and
  // it's recent. Cheap heuristic: pick the directory with the latest stamp
  // whose seed equals the world's seed.
  try {
    const dirs = readdirSync(resolve(config.dataDir));
    const matching = dirs
      .filter(d => d.endsWith(`__${world.meta.seed}`))
      .sort()
      .reverse();
    return matching[0] ?? null;
  } catch { return null; }
}

function serveRunRoute(dataRoot: string, path: string, url: URL, res: ServerResponse) {
  // /run/:id/{meta|snapshot|events}
  const parts = path.split("/").filter(Boolean); // ["run", id, sub]
  if (parts.length < 3) return error(res, 400, "bad run path");
  const id = decodeURIComponent(parts[1]!);
  const sub = parts[2]!;
  if (!isSafeRunId(id)) return error(res, 400, "bad id");
  const dir = join(dataRoot, id);
  let stat;
  try { stat = statSync(dir); } catch { return error(res, 404, "no such run"); }
  if (!stat.isDirectory()) return error(res, 404, "not a run");

  if (sub === "meta") {
    const meta = readRunMeta(dir, id);
    return json(res, meta);
  }
  if (sub === "snapshot") {
    const requested = Number(url.searchParams.get("tick") ?? "");
    const snapshots = listRunSnapshots(dir);
    if (snapshots.length === 0) return error(res, 404, "no snapshots yet");
    let pick = snapshots[snapshots.length - 1]!; // default: latest
    if (Number.isFinite(requested)) {
      // pick the largest snapshot tick <= requested
      const candidate = [...snapshots].reverse().find(t => t <= requested);
      pick = candidate ?? snapshots[0]!;
    }
    const file = join(dir, `tick-${String(pick).padStart(8, "0")}.snapshot.json`);
    res.setHeader("content-type", "application/json");
    res.setHeader("x-snapshot-tick", String(pick));
    return createReadStream(file).pipe(res);
  }
  if (sub === "events") {
    const from = Number(url.searchParams.get("from") ?? "0");
    const toRaw = url.searchParams.get("to");
    const to = toRaw == null ? Infinity : Number(toRaw);
    const file = join(dir, "events.jsonl");
    let body: string;
    try { body = readFileSync(file, "utf8"); }
    catch { return error(res, 404, "no events"); }
    const lines = body.split("\n").filter(Boolean);
    const out: string[] = [];
    for (const line of lines) {
      // Cheap tick extraction without full parse for tight ranges.
      const m = line.match(/"tick":(\d+)/);
      if (!m) continue;
      const tick = Number(m[1]!);
      if (tick < from) continue;
      if (tick > to) break;
      out.push(line);
    }
    res.setHeader("content-type", "application/x-ndjson");
    return res.end(out.join("\n"));
  }
  return error(res, 404, "unknown sub");
}

function readRunMeta(dir: string, id: string) {
  const snaps = listRunSnapshots(dir);
  let eventBytes = 0;
  let lastTick: number | null = snaps[snaps.length - 1] ?? null;
  try {
    eventBytes = statSync(join(dir, "events.jsonl")).size;
    const lastLine = tailLastLine(join(dir, "events.jsonl"));
    if (lastLine) {
      const m = lastLine.match(/"tick":(\d+)/);
      if (m) lastTick = Number(m[1]!);
    }
  } catch { /* no events */ }
  const stampSeed = id.split("__");
  return {
    id,
    startedAt: isoFromStamp(stampSeed[0] ?? ""),
    seed: stampSeed.slice(1).join("__"),
    snapshots: snaps,
    lastEventTick: lastTick,
    eventBytes,
  };
}

function listRunSnapshots(dir: string): number[] {
  const out: number[] = [];
  try {
    for (const f of readdirSync(dir)) {
      const m = f.match(/^tick-(\d+)\.snapshot\.json$/);
      if (m) out.push(Number(m[1]!));
    }
  } catch { /* */ }
  return out.sort((a, b) => a - b);
}

function tailLastLine(file: string): string | null {
  try {
    const body = readFileSync(file, "utf8");
    const lines = body.trimEnd().split("\n");
    return lines[lines.length - 1] ?? null;
  } catch { return null; }
}

function isoFromStamp(stamp: string): string {
  // "2026-05-17T13-48-27-504Z" → "2026-05-17T13:48:27.504Z"
  return stamp.replace(/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)/,
    "$1:$2:$3.$4");
}

function isSafeRunId(id: string): boolean {
  return /^[\w.\-:]+$/.test(id) && !id.includes("..");
}

function json(res: ServerResponse, data: unknown) {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
}
function error(res: ServerResponse, code: number, msg: string) {
  res.statusCode = code;
  json(res, { error: msg });
}
function cors(res: ServerResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET,OPTIONS");
  res.setHeader("access-control-expose-headers", "x-snapshot-tick");
}

export type _req = IncomingMessage;
export type _basename = typeof basename;
