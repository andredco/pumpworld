import type { Pill } from "@pumpworld/protocol";
import { config } from "../config.js";
import { clamp } from "../util/math.js";
import type { World } from "./World.js";

/**
 * Per-tick decay of physiological & social needs. Health drops if a need
 * crashes to zero, which is how pills can die of natural causes.
 */
export function tickNeeds(world: World, pill: Pill): void {
  if (pill.status === "dead" || pill.status === "exiled") return;

  const dt = 0.01 * config.needDrainScale;
  const sleeping = pill.status === "sleeping";
  // Hunger drains slower while sleeping (you're not exerting), much slower for incarcerated.
  pill.needs.hunger  = clamp(pill.needs.hunger  - dt * (sleeping ? 0.3 : 1.0), 0, 1);
  pill.needs.energy  = clamp(pill.needs.energy  - dt * (sleeping ? -3 : 0.7), 0, 1);
  pill.needs.social  = clamp(pill.needs.social  - dt * (sleeping ? 0.1 : 0.5), 0, 1);
  pill.needs.purpose = clamp(pill.needs.purpose - dt * 0.3, 0, 1);

  if (pill.needs.hunger <= 0 || pill.needs.energy <= 0) {
    // Slow bleed — gives agents time to recover before death from neglected needs.
    pill.health = clamp(pill.health - config.starvationBleedPerTick, 0, 1);
    if (pill.health <= 0) {
      pill.status = "dead";
      pill.diedAtTick = world.meta.tick;
      pill.causeOfDeath = pill.needs.hunger <= 0 ? "starvation" : "exhaustion";
      world.emit({ kind: "pill_died", pillId: pill.id, cause: pill.causeOfDeath, killerPillId: null });
    }
  }
}
