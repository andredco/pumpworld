import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorldSnapshot } from "@pumpworld/protocol";

export async function writeSnapshot(runDir: string, snap: WorldSnapshot): Promise<string> {
  const file = join(runDir, `tick-${String(snap.meta.tick).padStart(8, "0")}.snapshot.json`);
  await writeFile(file, JSON.stringify(snap));
  return file;
}
