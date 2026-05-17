/**
 * Hot-resume support.
 *
 * On startup, look in the data directory for the most recent run whose seed
 * matches the current world seed. If one exists and has a snapshot, hydrate
 * the World from that snapshot so the town continues from where it left off.
 *
 * This is what makes Pill World a *persistent* server — restarts (deploys,
 * crashes, container restarts) don't reset the town. The world picks up at
 * the last snapshot's tick and keeps going.
 *
 * Caveat: agent short-term memory is NOT persisted yet — it's reconstructed
 * empty on resume. Pill bios/secrets are rebuilt deterministically from pill ids
 * via syncPersonalitiesWithWorld() at startup. Long-term world state (pills,
 * buildings, blogs, market, incidents, trials, Spring cadence watermarks) resumes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
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
    const world = hydrateWorldFromSnapshot(json);
    return { world, runDir, resumedFromTick: snap.tick, source: "snapshot" };
  } catch (err) {
    console.warn(`[resume] failed to hydrate ${snap.file}: ${(err as Error).message}`);
    return { world: seedFn(), runDir: null, resumedFromTick: 0, source: "genesis" };
  }
}
