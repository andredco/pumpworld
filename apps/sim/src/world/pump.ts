/**
 * The Spring. The sacred fountain at the centre of Six Souls drips $SOULS
 * shards once per in-world hour, plus a larger "tide" at noon. Pills compete
 * to collect them; in-world currency is literally $SOULS.
 *
 * Drip/tide cadence is stored on WorldMeta (pumpLastClockSlot / pumpLastTideDay)
 * so server restarts resume correctly instead of repeating or skipping ticks.
 *
 * Render-cost notes:
 *   Each shard on the ground is a 3D mesh in the viewer. Six pills, each
 *   thinking once every ~6 wall-clock seconds (free-tier rate limits), can
 *   only pick up ~1 shard each per minute. Without a soft cap and an
 *   evaporation rule, shards pile up linearly and the browser scene melts.
 *   Tuned for a smooth viewer first; the in-fiction explanation is that
 *   uncollected shards "sublimate back into The Spring".
 */
import { nanoid } from "nanoid";
import type { Item } from "@pumpworld/protocol";
import type { World } from "./World.js";
import { makeRng } from "../util/rng.js";

const BASE_SHARDS_PER_HOUR = 1;
const BASE_TIDE_COUNT = 3;
const TIDE_HOUR = 12.0;
const FOUNTAIN_R = 4.5;

/**
 * Hard ceiling on uncollected currency items on the ground. Above this we
 * skip the next drip / cap the next tide instead of melting the scene.
 * Pills can still collect from the existing pile.
 */
const MAX_UNCOLLECTED_SHARDS = 18;

/**
 * After this many ticks (≈ 5 in-world hours / ~50 wall-clock seconds at
 * tickMs=2000) an uncollected shard evaporates. Bornish ones near pills
 * get picked up well before this; the cap is for the long tail.
 */
const SHARD_EVAPORATE_TICKS = 150;

interface ShardItem extends Item {
  kind: "currency";
}

function spawnShard(world: World, x: number, z: number, amount: number): string {
  const id = nanoid(8);
  const item: ShardItem = {
    id, kind: "currency", name: "$souls shard",
    position: { x, y: 0, z },
    ownerPillId: null,
    potency: amount,
  };
  world.items.set(id, item);
  world.emit({ kind: "item_spawned", itemId: id, item });
  // Tag spawn tick on the meta side-channel for evaporation. We avoid
  // changing the shared protocol just for this; using a Symbol-keyed prop
  // keeps the wire format clean while still letting us GC server-side.
  (item as unknown as { __spawnedAtTick?: number }).__spawnedAtTick = world.meta.tick;
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

/** Count uncollected shards (on the ground, no owner). Excludes purses in inventories. */
function uncollectedShardCount(world: World): number {
  let n = 0;
  for (const it of world.items.values()) {
    if (it.kind === "currency" && it.position && !it.ownerPillId) n++;
  }
  return n;
}

/**
 * Sweep ground shards older than SHARD_EVAPORATE_TICKS. Items in inventories
 * are immortal — only ground litter evaporates.
 */
function evaporateOldShards(world: World): void {
  if (world.meta.tick % 10 !== 0) return; // sweep every 10 ticks, not every tick
  const cutoff = world.meta.tick - SHARD_EVAPORATE_TICKS;
  for (const it of [...world.items.values()]) {
    if (it.kind !== "currency") continue;
    if (it.ownerPillId || !it.position) continue;
    const born = (it as unknown as { __spawnedAtTick?: number }).__spawnedAtTick;
    if (typeof born === "number" && born < cutoff) {
      world.items.delete(it.id);
      world.emit({ kind: "item_despawned", itemId: it.id });
    }
  }
}

export function tickPump(world: World): void {
  evaporateOldShards(world);
  world.meta.pumpInCirculation = Math.round(pumpCirculation(world));

  const hour = world.meta.hourOfDay;
  const wholeHour = Math.floor(hour);
  const clockSlot = world.meta.dayOfWorld * 24 + wholeHour;

  const abundance = world.meta.tokenInfluence?.abundance ?? 1;
  const shardsThisHour = Math.max(1, Math.round(BASE_SHARDS_PER_HOUR * abundance));
  const tideShards = Math.max(1, Math.round(BASE_TIDE_COUNT * abundance));

  // Soft cap: if the ground is already crowded with shards, skip this drip
  // entirely (the previous drips haven't been collected yet — the fountain
  // doesn't need to push more clutter into the scene).
  const onGround = uncollectedShardCount(world);
  const headroom = Math.max(0, MAX_UNCOLLECTED_SHARDS - onGround);

  // Noon tide — once per in-world day, persisted on meta.
  if (Math.abs(hour - TIDE_HOUR) < 0.1 && world.meta.pumpLastTideDay !== world.meta.dayOfWorld) {
    world.meta.pumpLastTideDay = world.meta.dayOfWorld;
    // Mark the noon hour slot as consumed too — the tide IS the noon delivery,
    // so we don't also fire the hourly drip on the very next sub-tick.
    world.meta.pumpLastClockSlot = clockSlot;
    const cappedTide = Math.min(tideShards, headroom);
    if (cappedTide <= 0) return;
    const rng = makeRng(`tide:${world.meta.seed}:${world.meta.dayOfWorld}`);
    const ids: string[] = [];
    let total = 0;
    for (let i = 0; i < cappedTide; i++) {
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

  const cappedDrip = Math.min(shardsThisHour, headroom);
  if (cappedDrip <= 0) return;

  const rng = makeRng(`drip:${world.meta.seed}:${clockSlot}`);
  const ids: string[] = [];
  let total = 0;
  for (let i = 0; i < cappedDrip; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = FOUNTAIN_R * (0.6 + rng.next() * 0.4);
    const amt = Math.round(rng.float(2, 8) * abundance);
    total += amt;
    ids.push(spawnShard(world, Math.cos(a) * r, Math.sin(a) * r, amt));
  }
  world.meta.pumpProducedTotal += total;
  world.emit({ kind: "pump_dripped", itemIds: ids, amount: total });
}
