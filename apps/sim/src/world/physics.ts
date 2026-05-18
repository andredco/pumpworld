import type { Pill, Vec3 } from "@pumpworld/protocol";
import { clamp, v3dist2D, v3norm, v3sub } from "../util/math.js";
import type { World } from "./World.js";

/** Pills walk at ~1.4 m/s. With a 2s tick that's ~2.8m/tick. */
const SPEED_M_PER_TICK = 2.8;

/**
 * Hard keep-out around the fountain at world centre. The Spring is a real
 * 3D structure (three stacked discs ~3m radius); without a collider, pills
 * happily walk straight through it because their thought is literally
 * `move_to {0,0}` and the perception block calls origin "the centre / The
 * Spring". The rim radius is slightly larger than the visual disc so they
 * stop *at* the fountain, not in it.
 */
const FOUNTAIN_KEEP_OUT_R = 4.0;

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

  // Fountain keep-out: if the brain's target is inside the Spring, clamp
  // the effective target to the rim along the same direction the pill is
  // approaching. Treats arrival as "you got to the fountain", which is
  // what the brain meant anyway.
  let effective = target;
  const dToCenter = Math.hypot(target.x, target.z);
  if (dToCenter < FOUNTAIN_KEEP_OUT_R) {
    if (dToCenter < 0.01) {
      // Brain literally said "go to (0,0)". Use the pill's current bearing
      // to the origin as the approach vector so we project to a sensible
      // edge instead of always landing at the same +x point.
      const cur = Math.hypot(pill.position.x, pill.position.z);
      if (cur > 0.01) {
        effective = {
          x: (pill.position.x / cur) * FOUNTAIN_KEEP_OUT_R,
          y: 0,
          z: (pill.position.z / cur) * FOUNTAIN_KEEP_OUT_R,
        };
      } else {
        effective = { x: FOUNTAIN_KEEP_OUT_R, y: 0, z: 0 };
      }
    } else {
      effective = {
        x: (target.x / dToCenter) * FOUNTAIN_KEEP_OUT_R,
        y: 0,
        z: (target.z / dToCenter) * FOUNTAIN_KEEP_OUT_R,
      };
    }
  }

  const delta = v3sub(effective, pill.position);
  const dist = v3dist2D(pill.position, effective);
  if (dist < 0.4) {
    pill.position = { x: effective.x, y: 0, z: effective.z };
    pill.velocity = { x: 0, y: 0, z: 0 };
    return true;
  }
  const step = Math.min(SPEED_M_PER_TICK, dist);
  const dir = v3norm({ x: delta.x, y: 0, z: delta.z });
  let nextX = clamp(pill.position.x + dir.x * step, -half, half);
  let nextZ = clamp(pill.position.z + dir.z * step, -half, half);

  // After the step, also veto positions that would land *inside* the
  // fountain (in case the path passed through it on a long stride).
  const nextR = Math.hypot(nextX, nextZ);
  if (nextR < FOUNTAIN_KEEP_OUT_R && nextR > 0.01) {
    nextX = (nextX / nextR) * FOUNTAIN_KEEP_OUT_R;
    nextZ = (nextZ / nextR) * FOUNTAIN_KEEP_OUT_R;
  }

  pill.position = { x: nextX, y: 0, z: nextZ };
  pill.velocity = { x: dir.x * step, y: 0, z: dir.z * step };
  pill.facingRad = Math.atan2(dir.x, dir.z);
  world.emit({
    kind: "pill_moved", pillId: pill.id,
    from: before, to: { ...pill.position },
  });
  return false;
}
