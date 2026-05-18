import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorldSnapshot } from "@pumpworld/protocol";

/**
 * Write a snapshot atomically. We write to a `.tmp` sibling first then rename
 * over the final path, so a crash/SIGTERM mid-write cannot leave a half-JSON
 * file that `JSON.parse` would throw on during `resumeOrSeed`.
 *
 * `fs.rename` is atomic on POSIX and on Windows when source and destination
 * sit in the same directory (which they do here).
 */
export async function writeSnapshot(runDir: string, snap: WorldSnapshot): Promise<string> {
  const file = join(runDir, `tick-${String(snap.meta.tick).padStart(8, "0")}.snapshot.json`);
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(snap));
  await rename(tmp, file);
  return file;
}
