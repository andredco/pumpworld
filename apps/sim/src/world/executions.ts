import { v3dist2D } from "../util/math.js";
import { stepTowards } from "./physics.js";
import type { World } from "./World.js";

/**
 * Move any pill in `awaiting_execution` toward the gallows each tick.
 * When they arrive (or run out of countdown ticks), they die there.
 *
 * This is intentionally automatic — sentence is the court's decision; the
 * walk is the ritual; the death is the law.
 */
export function tickExecutions(world: World): void {
  const gallows = [...world.buildings.values()].find(b => b.kind === "gallows");
  if (!gallows) return;
  for (const p of world.pills.values()) {
    if (p.status !== "awaiting_execution") continue;
    p.sentenceTicksRemaining = (p.sentenceTicksRemaining ?? 20) - 1;
    stepTowards(world, p, gallows.position, { executionMarch: true });
    const reached = v3dist2D(p.position, gallows.position) < 2.0;
    if (reached || (p.sentenceTicksRemaining ?? 0) <= 0) {
      p.status = "dead";
      p.diedAtTick = world.meta.tick;
      p.causeOfDeath = "executed at the gallows";
      p.health = 0;
      p.sentenceTicksRemaining = null;
      world.emit({ kind: "pill_executed", pillId: p.id, trialId: null });
      world.emit({ kind: "pill_died", pillId: p.id, cause: p.causeOfDeath, killerPillId: null });
    }
  }
}
