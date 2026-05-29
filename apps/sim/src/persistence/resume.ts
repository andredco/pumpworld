/**
 * Hot-resume support.
 *
 * On startup, look in the data directory for the most recent run whose seed
 * matches the current world seed. If one exists and has a snapshot, hydrate
 * the World from that snapshot so the town continues from where it left off.
 *
 * This is what makes The Pill Experiment a *persistent* server — restarts (deploys,
 * crashes, container restarts) don't reset the town. The world picks up at
 * the last snapshot's tick and keeps going.
 *
 * Caveat: agent short-term memory is NOT persisted yet — it's reconstructed
 * empty on resume. Pill bios/secrets are rebuilt deterministically from pill ids
 * via syncPersonalitiesWithWorld() at startup. Long-term world state (pills,
 * buildings, blogs, market, incidents, trials, Spring cadence watermarks) resumes.
 */
import { readdirSync, readFileSync, statSync, openSync, closeSync, ftruncateSync } from "node:fs";
import { join } from "node:path";
import type { WorldSnapshot } from "@pumpworld/protocol";
import { World } from "../world/World.js";

export interface ResumeResult {
  world: World;
  runDir: string | null;
  resumedFromTick: number;
  source: "genesis" | "snapshot";
}

/** Find the newest run directory in `dataRoot` whose suffix matches `seed`. */
export function findLatestRunForSeed(dataRoot: string, seed: string): string | null {
  let entries: string[];
  try { entries = readdirSync(dataRoot); }
  catch { return null; }

  const candidates = entries
    .filter(e => e.endsWith(`__${seed}`))
    .map(e => {
      const dir = join(dataRoot, e);
      try {
        const s = statSync(dir);
        return s.isDirectory() ? { dir, mtimeMs: s.mtimeMs } : null;
      } catch { return null; }
    })
    .filter((x): x is { dir: string; mtimeMs: number } => x != null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates[0]?.dir ?? null;
}

/** Find the newest snapshot file in a run directory. */
export function findLatestSnapshot(runDir: string): { file: string; tick: number } | null {
  let entries: string[];
  try { entries = readdirSync(runDir); }
  catch { return null; }
  const snaps = entries
    .map(name => {
      const m = name.match(/^tick-(\d+)\.snapshot\.json$/);
      return m ? { file: join(runDir, name), tick: Number(m[1]!) } : null;
    })
    .filter((x): x is { file: string; tick: number } => x != null)
    .sort((a, b) => b.tick - a.tick);
  return snaps[0] ?? null;
}

/** Rebuild a World from a snapshot. */
export function hydrateWorldFromSnapshot(snap: WorldSnapshot): World {
  const world = new World({ ...snap.meta });
  for (const p of snap.pills) world.pills.set(p.id, structuredClone(p));
  for (const i of snap.items) world.items.set(i.id, structuredClone(i));
  for (const b of snap.buildings) world.buildings.set(b.id, structuredClone(b));
  for (const p of snap.plots) world.plots.set(p.id, structuredClone(p));
  for (const i of snap.incidents) world.incidents.set(i.id, structuredClone(i));
  for (const t of snap.trials) world.trials.set(t.id, structuredClone(t));
  for (const b of (snap.blogPosts ?? [])) world.blogPosts.set(b.id, structuredClone(b));
  return world;
}

/** Try resume, fall back to provided seedFn. */
export function resumeOrSeed(
  dataRoot: string,
  seed: string,
  forceFresh: boolean,
  seedFn: () => World,
): ResumeResult {
  if (forceFresh) {
    return { world: seedFn(), runDir: null, resumedFromTick: 0, source: "genesis" };
  }
  const runDir = findLatestRunForSeed(dataRoot, seed);
  if (!runDir) return { world: seedFn(), runDir: null, resumedFromTick: 0, source: "genesis" };
  const snap = findLatestSnapshot(runDir);
  if (!snap) return { world: seedFn(), runDir: null, resumedFromTick: 0, source: "genesis" };
  try {
    const json = JSON.parse(readFileSync(snap.file, "utf8")) as WorldSnapshot;
    // Refuse to resume a graveyard. If every pill is dead/exiled in the
    // newest snapshot, the world has no future — restarting into it leaves
    // viewers staring at six corpses forever (this is exactly what happened
    // when the previous roster's API keys were invalid and every pill
    // starved before the next deploy). Reseed instead.
    const livingCount = json.pills.filter(p => p.status !== "dead" && p.status !== "exiled").length;
    if (livingCount === 0) {
      console.warn(
        `[resume] snapshot ${snap.file} has 0 living pills; reseeding from genesis instead of resuming a graveyard.`,
      );
      return { world: seedFn(), runDir: null, resumedFromTick: 0, source: "genesis" };
    }
    const world = hydrateWorldFromSnapshot(json);
    // Repair a possibly-truncated trailing line in events.jsonl from a hard
    // crash (SIGKILL mid-write), and seed the world's event-id counter past
    // anything already on disk so newly-emitted events keep ids monotonic.
    repairAndAlignEventLog(runDir, world);
    return { world, runDir, resumedFromTick: snap.tick, source: "snapshot" };
  } catch (err) {
    console.warn(`[resume] failed to hydrate ${snap.file}: ${(err as Error).message}`);
    return { world: seedFn(), runDir: null, resumedFromTick: 0, source: "genesis" };
  }
}

/**
 * Truncate any partial trailing line in events.jsonl, then advance the world's
 * `nextEventId` past the highest id already present so post-resume events
 * cannot collide with previously-written ones.
 */
function repairAndAlignEventLog(runDir: string, world: World): void {
  const file = join(runDir, "events.jsonl");
  let body: string;
  try { body = readFileSync(file, "utf8"); }
  catch { return; }
  if (body.length === 0) return;

  // If the file does not end in '\n', the last line is a partial write — drop it.
  let truncatedAt: number | null = null;
  if (!body.endsWith("\n")) {
    const lastNl = body.lastIndexOf("\n");
    truncatedAt = lastNl >= 0 ? lastNl + 1 : 0;
    body = body.slice(0, truncatedAt);
  }

  // Find the maximum event id that was successfully written.
  let maxId = 0;
  // Scan from the tail backward for performance — ids are monotonic so the
  // last well-formed line should hold the max.
  const lines = body.split("\n");
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 200; i--) {
    const line = lines[i];
    if (!line) continue;
    const m = line.match(/"id":(\d+)/);
    if (m) { maxId = Math.max(maxId, Number(m[1])); break; }
  }
  // Walk anything weird at the head if the tail fingerprint was missing.
  if (maxId === 0) {
    for (const line of lines) {
      const m = line.match(/"id":(\d+)/);
      if (m) maxId = Math.max(maxId, Number(m[1]));
    }
  }

  if (truncatedAt != null) {
    try {
      const fd = openSync(file, "r+");
      ftruncateSync(fd, truncatedAt);
      closeSync(fd);
      console.warn(`[resume] truncated partial trailing line in ${file} at byte ${truncatedAt}`);
    } catch (err) {
      console.warn(`[resume] could not truncate partial line: ${(err as Error).message}`);
    }
  }

  const fromMeta = world.meta.nextEventId ?? 1;
  world.meta.nextEventId = Math.max(fromMeta, maxId + 1);
}
