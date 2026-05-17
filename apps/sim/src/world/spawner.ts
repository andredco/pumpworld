import { nanoid } from "nanoid";
import type { Item } from "@pumpworld/protocol";
import type { World } from "./World.js";
import { makeRng } from "../util/rng.js";

/**
 * Keeps food on the map. Without this, pills exhaust starter food and starve
 * en masse. Production version replaces this with farms that yield crops.
 */
const FOOD_TARGET_DENSITY = 0.0015;   // ~60 food in a 200x200 world, baseline
const RESPAWN_EVERY_TICKS = 8;
const RESPAWN_BATCH = 3;
const NAMES = ["bread", "apple", "stew", "pear", "berries", "fish"] as const;

export function maybeSpawnFood(world: World): void {
  if (world.meta.tick % RESPAWN_EVERY_TICKS !== 0) return;
  // Abundance from the market multiplies the food cap; bull = feast, bear = scarcity.
  const abundance = world.meta.tokenInfluence?.abundance ?? 1;
  const targetCount = Math.max(8, Math.floor(world.meta.size * world.meta.size * FOOD_TARGET_DENSITY * abundance));
  const currentFood = [...world.items.values()].filter(i => i.kind === "food" && !i.ownerPillId).length;
  if (currentFood >= targetCount) return;

  const rng = makeRng(`spawner:${world.meta.seed}:${world.meta.tick}`);
  const half = world.meta.size / 2 - 10;
  const batch = Math.min(RESPAWN_BATCH, targetCount - currentFood);
  for (let i = 0; i < batch; i++) {
    const id = nanoid(8);
    const item: Item = {
      id, kind: "food", name: rng.pick(NAMES),
      position: { x: rng.float(-half, half), y: 0, z: rng.float(-half, half) },
      ownerPillId: null,
      potency: 0.45,
    };
    world.items.set(id, item);
    world.emit({ kind: "item_spawned", itemId: id, item });
  }
}
