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
  const incarcerated = pill.status === "incarcerated";
  // Hunger drains slower while sleeping (you're not exerting), much slower for incarcerated.
  // The state pays for jail food with much slower hunger; otherwise multi-tick
  // sentences are a death penalty in disguise (no eat action lands in a cell).
  const hungerMul = sleeping ? 0.3 : incarcerated ? 0.2 : 1.0;
  const energyMul = sleeping ? -3 : incarcerated ? 0.4 : 0.7;
  const socialMul = sleeping ? 0.1 : incarcerated ? 0.7 : 0.5;
  const purposeMul = incarcerated ? 0.6 : 0.3;
  pill.needs.hunger  = clamp(pill.needs.hunger  - dt * hungerMul,  0, 1);
  pill.needs.energy  = clamp(pill.needs.energy  - dt * energyMul,  0, 1);
  pill.needs.social  = clamp(pill.needs.social  - dt * socialMul,  0, 1);
  pill.needs.purpose = clamp(pill.needs.purpose - dt * purposeMul, 0, 1);

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
