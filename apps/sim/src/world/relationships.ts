import type { Pill, PillRelationship } from "@pumpworld/protocol";
import { clamp } from "../util/math.js";
import type { World } from "./World.js";

const DEFAULT_REL = (with_: string, tick: number): PillRelationship => ({
  with: with_, affinity: 0, trust: 0.3, tag: "stranger", lastSeenTick: tick,
});

function getOrCreate(pill: Pill, other: string, tick: number): PillRelationship {
  let r = pill.relationships.find(r => r.with === other);
  if (!r) {
    r = DEFAULT_REL(other, tick);
    pill.relationships.push(r);
  }
  return r;
}

export function adjustRelationship(
  world: World, a: Pill, b: Pill,
  delta: { affinity?: number; trust?: number; tag?: PillRelationship["tag"] },
): void {
  const ra = getOrCreate(a, b.id, world.meta.tick);
  if (delta.affinity != null) ra.affinity = clamp(ra.affinity + delta.affinity, -1, 1);
  if (delta.trust != null)    ra.trust    = clamp(ra.trust    + delta.trust,    0,  1);
  if (delta.tag != null)      ra.tag      = delta.tag;
  ra.lastSeenTick = world.meta.tick;
  world.emit({
    kind: "relationship_changed", pillId: a.id, with: b.id,
    tag: ra.tag, affinity: ra.affinity, trust: ra.trust,
  });
}

/** Two pills within 3m mutually update last-seen + tiny affinity bump. */
export function ambientSocialTick(world: World): void {
  const pills = world.alivePills();
  for (let i = 0; i < pills.length; i++) {
    for (let j = i + 1; j < pills.length; j++) {
      const a = pills[i]!, b = pills[j]!;
      const dx = a.position.x - b.position.x;
      const dz = a.position.z - b.position.z;
      if (dx * dx + dz * dz > 9) continue;
      a.needs.social = clamp(a.needs.social + 0.01, 0, 1);
      b.needs.social = clamp(b.needs.social + 0.01, 0, 1);
      const ra = getOrCreate(a, b.id, world.meta.tick);
      const rb = getOrCreate(b, a.id, world.meta.tick);
      ra.lastSeenTick = rb.lastSeenTick = world.meta.tick;
    }
  }
}
