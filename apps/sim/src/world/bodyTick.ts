/**
 * Continuous body motion. Runs every tick, regardless of brain cadence.
 *
 * Why this exists:
 *   The brain decides every ~3 ticks (config.agentThinkEvery). If movement
 *   only happened on tick decisions, pills would teleport one step every
 *   ~6 wall-clock seconds and then freeze. That looked like Roomba lag. By
 *   persisting the brain's chosen destination on `pill.pathTarget` and
 *   walking toward it from this tick, the body stays in continuous motion
 *   between thinks — same brain budget, much more alive on screen.
 *
 *   The brain still owns intent. This module only carries out movement the
 *   brain already chose; it does not pick destinations on its own.
 *
 *   Skipped for: dead, exiled, sleeping, unconscious, incarcerated, and
 *   awaiting_execution pills. (Execution march is its own loop.)
 */
import type { World } from "./World.js";
import { stepTowards } from "./physics.js";

export function tickBodies(world: World): void {
  for (const pill of world.pills.values()) {
    if (pill.status !== "alive") continue;
    const target = pill.pathTarget;
    if (!target) continue;
    const arrived = stepTowards(world, pill, target);
    if (arrived) pill.pathTarget = null;
  }
}
