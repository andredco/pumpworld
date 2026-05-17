import type { Pill, Vec3 } from "@pumpworld/protocol";
import { clamp, v3dist2D, v3norm, v3sub } from "../util/math.js";
import type { World } from "./World.js";

/** Pills walk at ~1.4 m/s. With a 2s tick that's ~2.8m/tick. */
const SPEED_M_PER_TICK = 2.8;

export interface MoveIntent {
  pillId: string;
  target: Vec3;
}

export interface StepTowardsOpts {
  /** Condemned pills march to the gallows while status is `awaiting_execution`. */
  executionMarch?: boolean;
}

/** Advance a pill toward its target. Returns true if the pill reached it this tick. */
export function stepTowards(world: World, pill: Pill, target: Vec3, opts?: StepTowardsOpts): boolean {
  const canMove =
    pill.status === "alive"
    || (opts?.executionMarch === true && pill.status === "awaiting_execution");
  if (!canMove) return false;
  const half = world.meta.size / 2;
  const before = { ...pill.position };
  const delta = v3sub(target, pill.position);
  const dist = v3dist2D(pill.position, target);
  if (dist < 0.4) {
    pill.position = { x: target.x, y: 0, z: target.z };
    pill.velocity = { x: 0, y: 0, z: 0 };
    return true;
  }
  const step = Math.min(SPEED_M_PER_TICK, dist);
  const dir = v3norm({ x: delta.x, y: 0, z: delta.z });
  pill.position = {
    x: clamp(pill.position.x + dir.x * step, -half, half),
    y: 0,
    z: clamp(pill.position.z + dir.z * step, -half, half),
  };
  pill.velocity = { x: dir.x * step, y: 0, z: dir.z * step };
  pill.facingRad = Math.atan2(dir.x, dir.z);
  world.emit({
    kind: "pill_moved", pillId: pill.id,
    from: before, to: { ...pill.position },
  });
  return false;
}
