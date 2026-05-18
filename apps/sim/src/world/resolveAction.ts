import { nanoid } from "nanoid";
import {
  BLOG_POST_BODY_MAX_CHARS,
  type Action,
  type BuildingKind,
  type Pill,
} from "@pumpworld/protocol";

import { clamp, v3dist2D } from "../util/math.js";
import { stepTowards } from "./physics.js";
import { adjustRelationship } from "./relationships.js";
import {
  concludeTrial, logIncident, recordStatement, startTrial,
} from "./justice.js";
import type { World } from "./World.js";

const REACH_M = 2.0;
const SPEAK_RADIUS_M = 6.0;

const BUILDING_KINDS: BuildingKind[] = [
  "house", "shop", "tavern", "temple", "courthouse",
  "jail", "farm", "workshop", "monument", "ruin",
];

function nearby(world: World, pill: Pill, radius: number): Pill[] {
  return world.alivePills().filter(p =>
    p.id !== pill.id && v3dist2D(p.position, pill.position) <= radius
  );
}

/** Apply an action to the world. Returns true if the action took effect. */
export function resolveAction(world: World, pill: Pill, action: Action): boolean {
  if (pill.status === "dead" || pill.status === "exiled") return false;
  if (pill.status === "incarcerated" && action.kind !== "speak" && action.kind !== "idle" && action.kind !== "testify") {
    return false;
  }
  if (pill.status === "awaiting_execution" && action.kind !== "speak" && action.kind !== "idle") {
    // Their walk to the gallows is automatic; we let them say last words.
    return false;
  }
  if (pill.status === "sleeping" && action.kind !== "idle" && action.kind !== "speak") {
    return false;
  }
  if (pill.status === "unconscious" && action.kind !== "idle") {
    return false;
  }
  pill.currentIntent = action.kind;

  switch (action.kind) {
    case "idle":
      return true;

    case "speak": {
      const audience = nearby(world, pill, SPEAK_RADIUS_M);
      world.emit({ kind: "pill_spoke", pillId: pill.id, to: action.to, text: action.text });
      pill.needs.social = clamp(pill.needs.social + 0.08, 0, 1);
      for (const a of audience) a.needs.social = clamp(a.needs.social + 0.035, 0, 1);
      return true;
    }

    case "move_to": {
      stepTowards(world, pill, action.target);
      return true;
    }

    case "follow": {
      const target = world.pills.get(action.pillId);
      if (!target || target.status === "dead" || target.status === "exiled") return false;
      stepTowards(world, pill, target.position);
      return true;
    }

    case "pickup": {
      const item = world.items.get(action.itemId);
      if (!item || item.ownerPillId || !item.position) return false;
      if (v3dist2D(item.position, pill.position) > REACH_M) return false;
      item.ownerPillId = pill.id;
      item.position = null;
      const entry = pill.inventory.find(e => e.itemId === item.id);
      if (entry) entry.count++;
      else pill.inventory.push({ itemId: item.id, count: 1 });
      world.emit({ kind: "pill_picked_up", pillId: pill.id, itemId: item.id });
      world.emit({ kind: "item_moved", itemId: item.id, position: null, ownerPillId: pill.id });
      return true;
    }

    case "drop": {
      const item = world.items.get(action.itemId);
      if (!item || item.ownerPillId !== pill.id) return false;
      item.ownerPillId = null;
      item.position = { ...pill.position };
      pill.inventory = pill.inventory.filter(e => e.itemId !== item.id);
      if (pill.weaponItemId === item.id) pill.weaponItemId = null;
      world.emit({ kind: "pill_dropped", pillId: pill.id, itemId: item.id });
      world.emit({ kind: "item_moved", itemId: item.id, position: { ...item.position }, ownerPillId: null });
      return true;
    }

    case "give": {
      const item = world.items.get(action.itemId);
      const to = world.pills.get(action.to);
      if (!item || item.ownerPillId !== pill.id || !to) return false;
      if (v3dist2D(to.position, pill.position) > REACH_M) return false;
      item.ownerPillId = to.id;
      pill.inventory = pill.inventory.filter(e => e.itemId !== item.id);
      to.inventory.push({ itemId: item.id, count: 1 });
      world.emit({ kind: "pill_gave", pillId: pill.id, itemId: item.id, to: to.id });
      world.emit({ kind: "item_moved", itemId: item.id, position: null, ownerPillId: to.id });
      adjustRelationship(world, to, pill, { affinity: 0.1, trust: 0.05 });
      return true;
    }

    case "eat": {
      const item = world.items.get(action.itemId);
      if (!item || item.ownerPillId !== pill.id || item.kind !== "food") return false;
      const gained = item.potency ?? 0.3;
      pill.needs.hunger = clamp(pill.needs.hunger + gained, 0, 1);
      world.items.delete(item.id);
      pill.inventory = pill.inventory.filter(e => e.itemId !== item.id);
      world.emit({ kind: "pill_ate", pillId: pill.id, itemId: item.id, gainedHunger: gained });
      world.emit({ kind: "item_despawned", itemId: item.id });
      return true;
    }

    case "sleep": {
      pill.status = "sleeping";
      // physics & needs tick reverses energy drain while sleeping
      world.emit({ kind: "pill_slept", pillId: pill.id, ticks: 1 });
      return true;
    }

    case "equip_weapon": {
      const item = world.items.get(action.itemId);
      if (!item || item.ownerPillId !== pill.id || item.kind !== "weapon") return false;
      pill.weaponItemId = item.id;
      world.emit({ kind: "pill_equipped", pillId: pill.id, itemId: item.id });
      return true;
    }

    case "attack": {
      const target = world.pills.get(action.pillId);
      if (!target || target.status === "dead" || target.status === "exiled") return false;
      if (v3dist2D(target.position, pill.position) > REACH_M) return false;
      const weapon = pill.weaponItemId ? world.items.get(pill.weaponItemId) : null;
      const base = weapon?.damage ?? 0.08;
      const mult = action.intent === "kill" ? 1.5 : action.intent === "wound" ? 1.0 : 0.4;
      const dmg = base * mult;
      target.health = clamp(target.health - dmg, 0, 1);
      world.emit({
        kind: "pill_attacked", pillId: pill.id, targetPillId: target.id,
        intent: action.intent, damage: dmg,
      });
      adjustRelationship(world, target, pill, { affinity: -0.3, trust: -0.4, tag: "enemy" });
      if (target.health <= 0) {
        target.status = "dead";
        target.diedAtTick = world.meta.tick;
        target.causeOfDeath = `killed by ${pill.name}`;
        world.emit({ kind: "pill_died", pillId: target.id, cause: target.causeOfDeath, killerPillId: pill.id });
        logIncident(world, "murder", target.position, pill, [target]);
      } else if (action.intent !== "scare") {
        logIncident(world, "assault", target.position, pill, [target]);
      }
      return true;
    }

    case "steal": {
      const item = world.items.get(action.itemId);
      const from = world.pills.get(action.from);
      if (!item || !from || item.ownerPillId !== from.id) return false;
      if (v3dist2D(from.position, pill.position) > REACH_M) return false;
      item.ownerPillId = pill.id;
      from.inventory = from.inventory.filter(e => e.itemId !== item.id);
      pill.inventory.push({ itemId: item.id, count: 1 });
      world.emit({ kind: "pill_picked_up", pillId: pill.id, itemId: item.id });
      world.emit({ kind: "item_moved", itemId: item.id, position: null, ownerPillId: pill.id });
      logIncident(world, "theft", pill.position, pill, [from]);
      adjustRelationship(world, from, pill, { affinity: -0.4, trust: -0.6, tag: "enemy" });
      return true;
    }

    case "arson": {
      const b = world.buildings.get(action.buildingId);
      if (!b || b.status === "rubble") return false;
      if (v3dist2D(b.position, pill.position) > REACH_M + 2) return false;
      b.status = "burning";
      b.integrity = clamp(b.integrity - 0.4, 0, 1);
      world.emit({ kind: "building_burning", buildingId: b.id, arsonistPillId: pill.id });
      logIncident(world, "arson", b.position, pill, []);
      return true;
    }

    case "vandalize": {
      const b = world.buildings.get(action.buildingId);
      if (!b) return false;
      if (v3dist2D(b.position, pill.position) > REACH_M + 1) return false;
      b.integrity = clamp(b.integrity - 0.1, 0, 1);
      if (b.integrity < 0.3 && b.status === "intact") b.status = "damaged";
      logIncident(world, "vandalism", b.position, pill, []);
      return true;
    }

    case "build_start": {
      const plot = world.plots.get(action.plotId);
      if (!plot || plot.buildingId) return false;
      const kind: BuildingKind = (BUILDING_KINDS as readonly string[]).includes(action.kind_)
        ? (action.kind_ as BuildingKind) : "house";
      const id = nanoid(8);
      const b = {
        id, kind, name: `${pill.name}'s ${kind}`,
        plotId: plot.id, position: { ...plot.position },
        size: { x: 8, z: 8 }, height: 4,
        ownerPillId: pill.id, occupants: [],
        status: "under_construction" as const,
        constructionProgress: 0, integrity: 1,
      };
      world.buildings.set(id, b);
      plot.buildingId = id;
      world.emit({ kind: "building_started", buildingId: id, ownerPillId: pill.id });
      return true;
    }

    case "build_work": {
      const b = world.buildings.get(action.buildingId);
      if (!b || b.status !== "under_construction") return false;
      if (v3dist2D(b.position, pill.position) > REACH_M + 2) return false;
      b.constructionProgress = clamp(b.constructionProgress + 0.1, 0, 1);
      world.emit({ kind: "building_progress", buildingId: b.id, progress: b.constructionProgress });
      if (b.constructionProgress >= 1) {
        b.status = "intact";
        world.emit({ kind: "building_completed", buildingId: b.id });
      }
      pill.needs.purpose = clamp(pill.needs.purpose + 0.05, 0, 1);
      return true;
    }

    case "craft": {
      // Stub: each recipe needs a material in inventory, produces a trinket.
      const mat = pill.inventory.find(e => {
        const it = world.items.get(e.itemId);
        return it?.kind === "material";
      });
      if (!mat) return false;
      const matItem = world.items.get(mat.itemId)!;
      world.items.delete(matItem.id);
      pill.inventory = pill.inventory.filter(e => e.itemId !== mat.itemId);
      const trinketId = nanoid(8);
      const trinket = {
        id: trinketId, kind: "trinket" as const, name: `${action.recipe}`,
        position: null, ownerPillId: pill.id,
      };
      world.items.set(trinketId, trinket);
      pill.inventory.push({ itemId: trinketId, count: 1 });
      world.emit({ kind: "item_spawned", itemId: trinketId, item: trinket });
      pill.needs.purpose = clamp(pill.needs.purpose + 0.08, 0, 1);
      return true;
    }

    case "pray":
      pill.needs.purpose = clamp(pill.needs.purpose + 0.1, 0, 1);
      pill.needs.safety  = clamp(pill.needs.safety + 0.05, 0, 1);
      return true;

    case "propose_relationship": {
      const other = world.pills.get(action.pillId);
      if (!other) return false;
      adjustRelationship(world, pill, other, { tag: action.tag, affinity: 0.05 });
      return true;
    }

    case "accuse": {
      const inc = world.incidents.get(action.incidentId);
      if (!inc) return false;
      // Only people with standing in the incident can name a suspect (matches
      // AGENTS.md: witnesses & victims direct the case, not bystanders inventing
      // suspects from the other side of town).
      const hasStanding =
        inc.witnessPillIds.includes(pill.id)
        || inc.victimPillIds.includes(pill.id)
        || inc.suspectPillId === pill.id; // a suspect can also redirect (confess to someone else)
      if (!hasStanding) return false;
      if (!inc.suspectPillId) inc.suspectPillId = action.suspectPillId;
      // Witness comes forward; could feed jury logic later.
      return true;
    }

    case "arrest": {
      // Only guards/judges can arrest, but we keep the rule loose for v0.
      if (pill.role.vocation !== "guard" && pill.role.vocation !== "judge") return false;
      const suspect = world.pills.get(action.suspectPillId);
      const inc = world.incidents.get(action.incidentId);
      if (!suspect || !inc) return false;
      // The arrest action must match the incident's named suspect; a guard
      // cannot drag a random pill to jail "for" some unrelated case.
      if (inc.suspectPillId == null || inc.suspectPillId !== suspect.id) return false;
      // Cannot arrest a pill who is not arrest-able. Guards against zombifying
      // a corpse via incarceration, double-jailing a defendant already on trial,
      // etc.
      if (
        suspect.status === "dead"
        || suspect.status === "exiled"
        || suspect.status === "incarcerated"
        || suspect.status === "awaiting_execution"
      ) return false;
      if (v3dist2D(suspect.position, pill.position) > REACH_M + 1) return false;
      suspect.status = "incarcerated";
      suspect.sentenceTicksRemaining = 20; // holding pending trial
      world.emit({ kind: "pill_arrested", pillId: suspect.id, byPillId: pill.id, incidentId: inc.id });
      startTrial(world, inc.id);
      return true;
    }

    case "testify":
      recordStatement(world, action.trialId, pill.id, action.statement);
      return true;

    case "rule_verdict": {
      const trial = world.trials.get(action.trialId);
      if (!trial || trial.judgePillId !== pill.id) return false;
      concludeTrial(world, trial.id, action.verdict, action.sentence, action.sentenceParam);
      return true;
    }

    case "blog_post": {
      // Anyone alive can publish. We rate-limit to one post per ~40 ticks per pill
      // so a runaway model doesn't spam the world.
      const recent = [...world.blogPosts.values()]
        .filter(p => p.authorPillId === pill.id)
        .sort((a, b) => b.publishedAtTick - a.publishedAtTick)[0];
      if (recent && world.meta.tick - recent.publishedAtTick < 40) return false;

      const id = nanoid(10);
      const post = {
        id,
        authorPillId: pill.id,
        title: action.title.slice(0, 200),
        body: action.body.slice(0, BLOG_POST_BODY_MAX_CHARS),
        publishedAtTick: world.meta.tick,
        publishedAtMs: Date.now(),
        coverImageUrl: null,
        tags: action.tags?.slice(0, 8) ?? [],
      };
      world.blogPosts.set(id, post);
      world.emit({
        kind: "blog_published",
        postId: id,
        authorPillId: pill.id,
        title: post.title,
        post,
      });
      pill.needs.purpose = clamp(pill.needs.purpose + 0.15, 0, 1);
      return true;
    }
  }
}
