/**
 * Vocation-driven daily task scheduler. The task is purely advisory — the
 * AI brain is free to ignore it — but it nudges coherent daily rhythms and gives
 * frontier models a sensible default to riff on.
 *
 * The task changes at certain hours: morning routine, work hours, evening,
 * sleep. It also reacts to local conditions (open trials, fires, etc).
 */

import type { Pill } from "@pumpworld/protocol";
import type { World } from "./World.js";

function pickTask(world: World, pill: Pill): string {
  const hour = world.meta.hourOfDay;
  // Global events that override personal schedule
  const fires = [...world.buildings.values()].filter(b => b.status === "burning");
  if (fires.length > 0 && (pill.role.vocation === "guard" || pill.role.vocation === "builder")) {
    return `respond to the fire at ${fires[0]!.name}`;
  }
  const openTrials = [...world.trials.values()].filter(t => t.concludedAtTick == null);
  if (pill.role.vocation === "judge" && openTrials.length > 0) {
    return `preside over trial ${openTrials[0]!.id}`;
  }
  if (openTrials.some(t => t.defendantPillId === pill.id)) {
    return `stand trial — defend yourself`;
  }
  if (pill.status === "incarcerated") {
    return `sit in jail and think`;
  }
  if (pill.status === "awaiting_execution") {
    return `walk to the gallows`;
  }

  // Daily schedule (hour-of-day driven).
  if (hour >= 22 || hour < 6) {
    // night → sleep at home
    return pill.homeBuildingId ? `go home and sleep` : `find a place to sleep`;
  }
  if (hour < 8) {
    return `wake up, eat breakfast`;
  }
  if (hour >= 18 && hour < 22) {
    // evening: socialise at the tavern or walk home
    return pill.role.vocation === "guard" ? `do an evening patrol` : `head to the tavern for a drink`;
  }

  // Work hours (8..18) — task depends on vocation
  switch (pill.role.vocation) {
    case "judge":    return `wait at the courthouse for cases`;
    case "merchant": return `mind the shop and look for customers`;
    case "guard":    return `patrol around the town hall and town square`;
    case "farmer":   return `tend the fields`;
    case "medic":    return `look for anyone who needs healing`;
    case "builder":  return `repair damaged buildings or build new things`;
    case "priest":   return `tend the temple, hear confessions`;
    case "scholar":  return `study at the temple library`;
    case "artist":   return `work on something beautiful`;
    case "drifter":  return `walk around town and people-watch`;
    default:         return `take care of personal business`;
  }
}

const REPLAN_EVERY_TICKS = 15;

export function tickTasks(world: World): void {
  if (world.meta.tick % REPLAN_EVERY_TICKS !== 0) return;
  for (const pill of world.pills.values()) {
    if (pill.status === "dead" || pill.status === "exiled") continue;
    const next = pickTask(world, pill);
    if (next !== pill.currentTask) {
      pill.currentTask = next;
      world.emit({ kind: "task_changed", pillId: pill.id, task: next });
    }
  }
}
