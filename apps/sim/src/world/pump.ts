/**
 * The Spring. The sacred fountain at the centre of Pill World drips $PILLS
 * shards once per in-world hour, plus a larger "tide" at noon. Pills compete
 * to collect them; in-world currency is literally $PILLS.
 *
 * Drip/tide cadence is stored on WorldMeta (pumpLastClockSlot / pumpLastTideDay)
 * so server restarts resume correctly instead of repeating or skipping ticks.
 */
import { nanoid } from "nanoid";
import type { Item } from "@pumpworld/protocol";
import type { World } from "./World.js";
import { makeRng } from "../util/rng.js";

const BASE_SHARDS_PER_HOUR = 2;
const BASE_TIDE_COUNT = 6;
const TIDE_HOUR = 12.0;
const FOUNTAIN_R = 4.5;

function spawnShard(world: World, x: number, z: number, amount: number): string {
  const id = nanoid(8);
  const item: Item = {
    id, kind: "currency", name: "$pills shard",
    position: { x, y: 0, z },
    ownerPillId: null,
    potency: amount,
  };
  world.items.set(id, item);
  world.emit({ kind: "item_spawned", itemId: id, item });
  return id;
}

function pumpCirculation(world: World): number {
  let total = 0;
  for (const it of world.items.values()) {
    if (it.kind !== "currency") continue;
    total += it.potency ?? 0;
  }
  return total;
}

export function tickPump(world: World): void {
  world.meta.pumpInCirculation = Math.round(pumpCirculation(world));

  const hour = world.meta.hourOfDay;
  const wholeHour = Math.floor(hour);
  const clockSlot = world.meta.dayOfWorld * 24 + wholeHour;

  const abundance = world.meta.tokenInfluence?.abundance ?? 1;
  const shardsThisHour = Math.max(1, Math.round(BASE_SHARDS_PER_HOUR * abundance));
  const tideShards = Math.max(2, Math.round(BASE_TIDE_COUNT * abundance));

  // Noon tide — once per in-world day, persisted on meta.
  if (Math.abs(hour - TIDE_HOUR) < 0.1 && world.meta.pumpLastTideDay !== world.meta.dayOfWorld) {
    world.meta.pumpLastTideDay = world.meta.dayOfWorld;
    const rng = makeRng(`tide:${world.meta.seed}:${world.meta.dayOfWorld}`);
    const ids: string[] = [];
    let total = 0;
    for (let i = 0; i < tideShards; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = FOUNTAIN_R * (0.6 + rng.next() * 0.6);
      const amt = Math.round(rng.float(5, 20) * abundance);
      total += amt;
      ids.push(spawnShard(world, Math.cos(a) * r, Math.sin(a) * r, amt));
    }
    world.meta.pumpProducedTotal += total;
    world.emit({ kind: "pump_tide", itemIds: ids, amount: total });
    return;
  }

  if (world.meta.pumpLastClockSlot === clockSlot) return;
  world.meta.pumpLastClockSlot = clockSlot;

  const rng = makeRng(`drip:${world.meta.seed}:${clockSlot}`);
  const ids: string[] = [];
  let total = 0;
  for (let i = 0; i < shardsThisHour; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = FOUNTAIN_R * (0.6 + rng.next() * 0.4);
    const amt = Math.round(rng.float(2, 8) * abundance);
    total += amt;
    ids.push(spawnShard(world, Math.cos(a) * r, Math.sin(a) * r, amt));
  }
  world.meta.pumpProducedTotal += total;
  world.emit({ kind: "pump_dripped", itemIds: ids, amount: total });
}
