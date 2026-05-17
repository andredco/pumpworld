import { nanoid } from "nanoid";
import type {
  Incident, IncidentKind, Pill, Sentence, Trial, Vec3, Verdict,
} from "@pumpworld/protocol";
import type { World } from "./World.js";

/** Open an incident record. Witnesses are picked from pills within 8m. */
export function logIncident(
  world: World, kind: IncidentKind, location: Vec3,
  suspect: Pill | null, victims: Pill[],
): Incident {
  const witnesses = world.alivePills().filter(p => {
    if (suspect && p.id === suspect.id) return false;
    if (victims.some(v => v.id === p.id)) return false;
    const dx = p.position.x - location.x;
    const dz = p.position.z - location.z;
    return dx * dx + dz * dz <= 64;
  }).map(p => p.id);

  const inc: Incident = {
    id: nanoid(8), kind, tick: world.meta.tick,
    suspectPillId: suspect?.id ?? null,
    victimPillIds: victims.map(v => v.id),
    witnessPillIds: witnesses,
    location: { ...location },
    description: `${kind} at (${location.x.toFixed(1)}, ${location.z.toFixed(1)})`,
    trialId: null, resolved: false,
  };
  world.incidents.set(inc.id, inc);
  if (suspect) {
    suspect.role.notoriety += notorietyFor(kind);
  }
  world.emit({
    kind: "incident_logged", incidentId: inc.id,
    incidentKind: kind, suspectPillId: suspect?.id ?? null,
  });
  return inc;
}

function notorietyFor(k: IncidentKind): number {
  switch (k) {
    case "murder":   return 1.0;
    case "arson":    return 0.6;
    case "robbery":  return 0.5;
    case "assault":  return 0.4;
    case "theft":    return 0.3;
    case "fraud":    return 0.3;
    case "vandalism":return 0.2;
    case "trespass": return 0.1;
    case "perjury":  return 0.4;
    case "treason":  return 1.0;
    case "public_disorder": return 0.15;
  }
}

/** Open a trial from an existing incident. Picks a judge by vocation if possible. */
export function startTrial(world: World, incidentId: string): Trial | null {
  const inc = world.incidents.get(incidentId);
  if (!inc || inc.trialId) return null;
  if (!inc.suspectPillId) return null;
  const defendant = world.pills.get(inc.suspectPillId);
  if (!defendant || defendant.status === "dead") return null;

  const judge = world.alivePills().find(p => p.role.vocation === "judge" && p.id !== defendant.id)
             ?? world.alivePills().find(p => p.id !== defendant.id);

  const trial: Trial = {
    id: nanoid(8),
    incidentId: inc.id,
    defendantPillId: defendant.id,
    judgePillId: judge?.id ?? null,
    startedAtTick: world.meta.tick,
    concludedAtTick: null,
    verdict: null,
    sentence: null,
    sentenceParam: null,
    statements: [],
  };
  world.trials.set(trial.id, trial);
  inc.trialId = trial.id;
  world.emit({
    kind: "trial_started", trialId: trial.id, incidentId: inc.id,
    defendantPillId: defendant.id, judgePillId: judge?.id ?? null,
  });
  return trial;
}

export function recordStatement(
  world: World, trialId: string, pillId: string, text: string,
): void {
  const trial = world.trials.get(trialId);
  if (!trial || trial.concludedAtTick != null) return;
  trial.statements.push({ pillId, text, tick: world.meta.tick });
  world.emit({ kind: "trial_statement", trialId, pillId, text });
}

export function concludeTrial(
  world: World, trialId: string,
  verdict: Verdict, sentence: Sentence, sentenceParam: number | null,
): void {
  const trial = world.trials.get(trialId);
  if (!trial || trial.concludedAtTick != null) return;
  trial.concludedAtTick = world.meta.tick;
  trial.verdict = verdict;
  trial.sentence = sentence;
  trial.sentenceParam = sentenceParam;

  const def = world.pills.get(trial.defendantPillId);
  const inc = world.incidents.get(trial.incidentId);
  if (inc) inc.resolved = true;
  if (def && verdict === "guilty") {
    switch (sentence) {
      case "fine":
        def.role.wealth = Math.max(0, def.role.wealth - (sentenceParam ?? 10));
        break;
      case "jail":
        def.status = "incarcerated";
        def.sentenceTicksRemaining = sentenceParam ?? 30;
        break;
      case "exile":
        def.status = "exiled";
        world.emit({ kind: "pill_exiled", pillId: def.id });
        break;
      case "death":
        // The court doesn't kill — the gallows does. Hand the pill over to
        // the execution loop; they walk there, then die.
        def.status = "awaiting_execution";
        def.sentenceTicksRemaining = sentenceParam ?? 20;
        break;
      case "none": break;
    }
  }
  world.emit({
    kind: "trial_concluded", trialId, verdict, sentence, sentenceParam,
  });
}

/** Decrement jail sentences each tick; release at zero. */
export function tickIncarceration(world: World): void {
  for (const p of world.pills.values()) {
    if (p.status !== "incarcerated") continue;
    if (p.sentenceTicksRemaining == null) { p.status = "alive"; continue; }
    p.sentenceTicksRemaining--;
    if (p.sentenceTicksRemaining <= 0) {
      p.status = "alive";
      p.sentenceTicksRemaining = null;
      world.emit({ kind: "pill_released", pillId: p.id });
    }
  }
}
