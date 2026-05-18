import { nanoid } from "nanoid";
import type {
  Building, Gender, Item, Personality, Pill, PillSoul, Plot, Season, WorldMeta,
} from "@pumpworld/protocol";

import { config } from "../config.js";
import { makeRng, type Rng } from "../util/rng.js";
import { v3 } from "../util/math.js";
import { World } from "./World.js";

/**
 * The six-pill cast. One pill per soul; we want every model represented
 * exactly once so a viewer can recognise each personality.
 */
interface RosterEntry {
  soul: PillSoul;
  name: string;
  gender: Gender;
  vocation: string;
  /** Hex pair (top / bottom shell colour). */
  shell: [string, string];
}

/**
 * The six-pill cast.
 *
 * Public personas (Claude / GPT / Grok / Gemini / GLM / DeepSeek) are
 * **fiction the viewers see**. Under the hood we route through the cheapest
 * available API endpoints that keep the experiment running 24/7 without
 * burning a hole in the OpenRouter / Anthropic / xAI bills:
 *
 *   - 3 souls on **OpenAI Chat Completions** (`OPENAI_API_KEY`) — the cheap
 *     mini / nano tier of the GPT family.
 *   - 3 souls on **Gemini Developer API** (`GEMINI_API_KEY`) — the free
 *     tier (gemini-2.5-pro / -flash / -flash-lite). Each model has its own
 *     RPM bucket on the free tier, so spreading across all three models
 *     buys us roughly 3× the per-pill think budget vs. routing all three
 *     pills through one Gemini slug.
 *
 * The constitution (AGENTS.md) says pills are "routed through OpenRouter".
 * That's the prose framing for viewers; operationally we choose the
 * cheapest provider per soul. If you want to flip the entire cast back to
 * OpenRouter (one key, six minds), there's an OpenRouter provider already
 * wired up — just edit the `provider` field below.
 *
 * Cast labels stay Claude / GPT / Grok / Gemini / GLM / DeepSeek.
 * Real backends are picked per pill for cost.
 */
const ROSTER: RosterEntry[] = [
  {
    soul: { provider: "openai", model: "gpt-4o-mini", label: "Claude" },
    name: "Pluto", gender: "female", vocation: "judge",
    shell: ["#ff5c8a", "#ffe0ec"],
  },
  {
    soul: { provider: "openai", model: "gpt-4.1-mini", label: "GPT" },
    name: "Coral", gender: "male", vocation: "merchant",
    shell: ["#5ac8fa", "#e6f6ff"],
  },
  {
    soul: { provider: "openai", model: "gpt-4.1-nano", label: "Grok" },
    name: "Indigo", gender: "nonbinary", vocation: "guard",
    shell: ["#b07cff", "#ffe4f9"],
  },
  {
    soul: { provider: "gemini", model: "gemini-2.5-flash", label: "Gemini" },
    name: "Mango", gender: "male", vocation: "farmer",
    shell: ["#ffd23f", "#3a2a00"],
  },
  {
    soul: { provider: "gemini", model: "gemini-2.5-flash-lite", label: "GLM" },
    name: "Hazel", gender: "female", vocation: "medic",
    shell: ["#34e0a1", "#0a3b29"],
  },
  {
    soul: { provider: "gemini", model: "gemini-2.5-pro", label: "DeepSeek" },
    name: "Sable", gender: "other", vocation: "builder",
    shell: ["#ff6f3c", "#fff1d6"],
  },
];

/** Pill name, cast label, and OpenRouter slug; used by `npm run test:models` (OpenRouter pills only). */
export const OPENROUTER_ROSTER_HEALTHCHECK = ROSTER.filter(r => r.soul.provider === "openrouter").map(r => ({
  pillName: r.name,
  castLabel: r.soul.label,
  model: r.soul.model,
}));

function randomPersonality(rng: Rng, label: string, vocation: string): Personality {
  const f = () => Number(rng.float(0, 1).toFixed(2));
  const ocean = {
    openness: f(), conscientiousness: f(), extraversion: f(),
    agreeableness: f(), neuroticism: f(),
  };
  const custom = {
    criminality: f(), aggression: f(), romanticism: f(), spirituality: f(),
    greed: f(), ambition: f(), forgivingness: f(),
  };
  const voices = ["terse and sardonic", "warm and verbose", "anxious and precise", "lyrical and grandiose", "blunt and pragmatic", "playful and ironic"];
  const secrets = [
    "they buried something in the south field",
    "they are not who they say they are",
    "they owe a debt they cannot repay",
    "they once watched a death and said nothing",
    "they love someone they should not",
    "they remember a previous life as another pill",
  ];
  const values = [
    "never strike first", "tell the truth on Sundays", "honour debts",
    "protect the small", "the temple comes first", "build, do not destroy",
    "money is freedom",
  ];
  return {
    ocean, custom,
    bio: `${label} pill. Vocation: ${vocation}. Trait profile drawn at spawn; will reveal under pressure.`,
    voice: rng.pick(voices),
    values: [rng.pick(values), rng.pick(values)].filter((v, i, a) => a.indexOf(v) === i),
    secret: rng.pick(secrets),
  };
}

/** Currently we attach personality on a side channel; protocol stays clean. */
export const personalities = new Map<string, Personality>();

/**
 * Keep personality blobs aligned with actual pills (snapshot resume, stray ids).
 * Deterministic per pill id so reboots do not rewrite characters mid-stream.
 */
export function syncPersonalitiesWithWorld(world: World): void {
  const wanted = new Set(world.pills.keys());
  for (const id of [...personalities.keys()]) {
    if (!wanted.has(id)) personalities.delete(id);
  }
  const rngBase = makeRng(`${world.meta.seed}|pill_personality`);
  for (const pill of world.pills.values()) {
    if (!personalities.has(pill.id)) {
      personalities.set(
        pill.id,
        randomPersonality(rngBase.fork(`personality:${pill.id}`), pill.soul.label, pill.role.vocation),
      );
    }
  }
}

function defaultTaskFor(vocation: string): string {
  switch (vocation) {
    case "judge":    return "preside over the courthouse";
    case "merchant": return "mind the shop";
    case "guard":    return "patrol the streets and keep the peace";
    case "farmer":   return "tend the fields and bring in the harvest";
    case "medic":    return "treat the sick and keep an eye on the weak";
    case "builder":  return "repair damage and build new things";
    case "priest":   return "tend the temple, pray for the town";
    case "scholar":  return "read, learn, write down what happens";
    case "artist":   return "make something beautiful or strange";
    default:         return "wander and see what happens";
  }
}

export function seedWorld(): World {
  const rng = makeRng(config.seed);
  const size = 200;
  const meta: WorldMeta = {
    seed: config.seed,
    tickMs: config.tickMs,
    tick: 0,
    startedAtMs: Date.now(),
    size,
    townCentre: v3(0, 0, 0),
    ticksPerDay: config.ticksPerDay,
    hourOfDay: 8.0,
    dayOfWorld: 0,
    season: "spring" as Season,
    weather: "clear",
    temperatureCelsius: 16,
    pumpProducedTotal: 0,
    pumpInCirculation: 0,
    tokenStats: {
      symbol: "$PILLS",
      mintAddress: config.token.mintAddress || null,
      source: "dexscreener",
      priceUsd: 0,
      marketCapUsd: 0,
      volume24hUsd: 0,
      priceChange1hPct: 0,
      priceChange24hPct: 0,
      holders: 0,
      lastUpdatedMs: 0,
      spark: [],
    },
    tokenInfluence: { mood: 0, abundance: 1, volatility: 0 },
  };
  const world = new World(meta);
  world.emit({ kind: "world_started", seed: config.seed });

  // --- plots: a 5x5 town grid around the centre, with the centre slot reserved
  //     as an open square (no plot) so the fountain has room to breathe ---
  const plotSize = 24;
  const gap = 8;
  const cellPitch = plotSize + gap;
  const plotRng = rng.fork("plots");
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (gx === 0 && gz === 0) continue;
      const id = nanoid(8);
      const r2 = gx * gx + gz * gz;
      const zoning =
        r2 === 1 ? "civic" :
        r2 === 2 ? (plotRng.bool() ? "commercial" : "residential") :
        r2 >= 5 ? (plotRng.bool(0.7) ? "agricultural" : "wild") :
        plotRng.bool(0.6) ? "residential" :
        plotRng.bool(0.6) ? "commercial" : "agricultural";
      const plot: Plot = {
        id,
        position: v3(gx * cellPitch, 0, gz * cellPitch),
        size: { x: plotSize, z: plotSize },
        ownerPillId: null,
        buildingId: null,
        zoning,
      };
      world.plots.set(id, plot);
    }
  }

  // --- helper: drop a building on the first matching plot ---
  const placedPlots = new Set<string>();
  const pickPlot = (predicate: (p: Plot) => boolean) => {
    const candidates = [...world.plots.values()].filter(p =>
      !p.buildingId && !placedPlots.has(p.id) && predicate(p)
    );
    if (candidates.length === 0) return null;
    const chosen = candidates[Math.floor(plotRng.next() * candidates.length)]!;
    placedPlots.add(chosen.id);
    return chosen;
  };

  const place = (
    plot: Plot,
    kind: Building["kind"],
    name: string,
    size: { x: number; z: number; h: number },
    ownerPillId: string | null = null,
  ) => {
    const b: Building = {
      id: nanoid(8), kind, name, plotId: plot.id,
      position: { ...plot.position },
      size: { x: size.x, z: size.z }, height: size.h,
      ownerPillId, occupants: [], status: "intact",
      constructionProgress: 1, integrity: 1,
    };
    world.buildings.set(b.id, b);
    plot.buildingId = b.id;
    return b;
  };

  // --- civic ring (zoning = "civic") ---
  // Place each on a distinct civic plot. We want exactly: courthouse, town hall,
  // jail, temple. Gallows is right next to the courthouse.
  const civicSpecs: { kind: Building["kind"]; name: string; size: { x: number; z: number; h: number } }[] = [
    { kind: "courthouse", name: "Pill World Courthouse",  size: { x: 16, z: 16, h: 8 } },
    { kind: "town_hall",  name: "Pill World Town Hall",   size: { x: 18, z: 14, h: 9 } },
    { kind: "temple",     name: "Temple of the Spring",   size: { x: 12, z: 12, h: 10 } },
    { kind: "jail",       name: "Pill World Holding",     size: { x: 14, z: 12, h: 6 } },
  ];
  let courthouse: Building | null = null;
  for (const spec of civicSpecs) {
    const plot = pickPlot(p => p.zoning === "civic");
    if (!plot) continue;
    const b = place(plot, spec.kind, spec.name, spec.size);
    if (b.kind === "courthouse") courthouse = b;
  }
  // Gallows — sits inside the courthouse plot footprint, slightly offset, no
  // plot of its own.
  if (courthouse) {
    const g: Building = {
      id: nanoid(8), kind: "gallows", name: "The Gallows",
      plotId: courthouse.plotId,
      position: {
        x: courthouse.position.x + 6,
        y: 0,
        z: courthouse.position.z + 6,
      },
      size: { x: 3, z: 3 }, height: 3,
      ownerPillId: null, occupants: [], status: "intact",
      constructionProgress: 1, integrity: 1,
    };
    world.buildings.set(g.id, g);
  }

  // --- one tavern + two shops + two farms + one workshop ---
  const tavernPlot = pickPlot(p => p.zoning === "commercial");
  if (tavernPlot) place(tavernPlot, "tavern", "The Drowsy Capsule", { x: 12, z: 12, h: 6 });
  const shopPlot1 = pickPlot(p => p.zoning === "commercial");
  if (shopPlot1) place(shopPlot1, "shop", "The General Store", { x: 10, z: 10, h: 5 });
  const shopPlot2 = pickPlot(p => p.zoning === "commercial");
  if (shopPlot2) place(shopPlot2, "shop", "Capsule & Co.", { x: 10, z: 10, h: 5 });
  const farm1 = pickPlot(p => p.zoning === "agricultural");
  if (farm1) place(farm1, "farm", "Sunfield Farm", { x: 18, z: 18, h: 4 });
  const farm2 = pickPlot(p => p.zoning === "agricultural");
  if (farm2) place(farm2, "farm", "Brookmill Farm", { x: 18, z: 18, h: 4 });
  const workshopPlot = pickPlot(p => p.zoning === "residential" || p.zoning === "commercial");
  if (workshopPlot) place(workshopPlot, "workshop", "The Brass Workshop", { x: 12, z: 12, h: 6 });

  // --- one named house per pill in the roster (six houses) ---
  const houses: Building[] = [];
  for (const member of ROSTER) {
    const plot = pickPlot(p => p.zoning === "residential")
              ?? pickPlot(p => p.zoning === "wild");
    if (!plot) continue;
    const palette = ["#f6a6c1", "#a8d8ff", "#c8e6b8", "#ffe4a3", "#d4a3ff", "#ffb6a3"];
    // Houses are smaller; height varies a bit per pill so they feel distinct.
    const houseHeight = 4 + (member.name.length % 3);
    const b = place(plot, "house", `${member.name}'s House`,
      { x: 10, z: 10, h: houseHeight });
    // Tag with the index so we can match it back to the roster later.
    // (Owner pill id gets filled in once the pill exists.)
    houses.push(b);
    void palette; // colour is rolled per-building clientside
  }

  // --- monument on whatever is left, for flavour ---
  const monumentPlot = pickPlot(_ => true);
  if (monumentPlot) place(monumentPlot, "monument", "The Genesis Pill", { x: 8, z: 8, h: 12 });

  // --- scatter starter items ---
  const itemRng = rng.fork("items");
  const itemSpawns: Array<Omit<Item, "id">> = [];
  for (let i = 0; i < 36; i++) {
    itemSpawns.push({
      kind: "food",
      name: itemRng.pick(["bread", "apple", "stew", "pear", "berries", "fish", "groceries"]),
      position: v3(itemRng.float(-size / 2 + 12, size / 2 - 12), 0, itemRng.float(-size / 2 + 12, size / 2 - 12)),
      ownerPillId: null, potency: 0.45,
    });
  }
  for (let i = 0; i < 12; i++) {
    itemSpawns.push({
      kind: "material",
      name: itemRng.pick(["plank", "stone", "nail", "thread"]),
      position: v3(itemRng.float(-size / 2 + 12, size / 2 - 12), 0, itemRng.float(-size / 2 + 12, size / 2 - 12)),
      ownerPillId: null,
    });
  }
  // Weapons: a knife, a club, a pistol, a shotgun — scattered.
  const weaponSpecs: { name: string; damage: number; illegal: boolean }[] = [
    { name: "knife",   damage: 0.25, illegal: true },
    { name: "club",    damage: 0.20, illegal: false },
    { name: "pistol",  damage: 0.55, illegal: true },
    { name: "shotgun", damage: 0.75, illegal: true },
  ];
  for (const w of weaponSpecs) {
    itemSpawns.push({
      kind: "weapon", name: w.name,
      position: v3(itemRng.float(-size / 2 + 12, size / 2 - 12), 0, itemRng.float(-size / 2 + 12, size / 2 - 12)),
      ownerPillId: null, damage: w.damage, illegal: w.illegal,
    });
  }
  for (const spec of itemSpawns) {
    const id = nanoid(8);
    const item: Item = { id, ...spec };
    world.items.set(id, item);
    world.emit({ kind: "item_spawned", itemId: id, item });
  }

  // --- spawn the six pills, clustered around the town square / Spring so
  //     they're in earshot of each other from tick 1. Houses still exist,
  //     but day 1 wakes up at the fountain instead of six isolated lawns
  //     30+ metres apart (otherwise it takes ~5 real minutes for any two
  //     pills to walk into speech range and the world feels dead). ---
  const spawnRng = rng.fork("pills");
  ROSTER.forEach((member, i) => {
    const house = houses[i] ?? null;
    // Six pills evenly arranged around the fountain at ~6m radius — that's
    // exactly the speech radius, so most pairs start in or just outside
    // earshot, encouraging organic conversation.
    const angle = (i / ROSTER.length) * Math.PI * 2;
    const radius = 5 + spawnRng.float(0, 1.5);
    const spawnPos = {
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
    };
    void house;

    // Pick a workplace by vocation.
    const findBuilding = (kind: Building["kind"]) =>
      [...world.buildings.values()].find(b => b.kind === kind) ?? null;
    let work: Building | null = null;
    switch (member.vocation) {
      case "judge":    work = findBuilding("courthouse"); break;
      case "merchant": work = findBuilding("shop"); break;
      case "guard":    work = findBuilding("town_hall"); break;
      case "farmer":   work = findBuilding("farm"); break;
      case "medic":    work = findBuilding("temple"); break;
      case "builder":  work = findBuilding("workshop"); break;
      case "priest":   work = findBuilding("temple"); break;
      case "scholar":  work = findBuilding("temple"); break;
      case "artist":   work = findBuilding("monument"); break;
      default:         work = null;
    }

    const pill: Pill = {
      id: nanoid(8),
      name: member.name,
      gender: member.gender,
      soul: { ...member.soul },
      shell: {
        topColor: member.shell[0],
        bottomColor: member.shell[1],
        bandColor: "#111111",
        height: 1.6,
        radius: 0.5,
      },
      position: spawnPos,
      // Face inward, toward the fountain at origin — six pills standing
      // around the Spring at sunrise read as "the day is starting".
      facingRad: Math.atan2(-spawnPos.x, -spawnPos.z),
      velocity: v3(),
      status: "alive",
      health: 1,
      sentenceTicksRemaining: null,
      needs: {
        // Wake up already a little behind — gives the brain something
        // concrete to act on in the first minute (eat, chat, find a coin)
        // instead of "everything is fine, idle".
        hunger: spawnRng.float(0.55, 0.75),
        energy: spawnRng.float(0.75, 0.92),
        social: spawnRng.float(0.40, 0.65),
        safety: 0.92,
        purpose: spawnRng.float(0.35, 0.65),
      },
      role: {
        vocation: member.vocation,
        wealth: spawnRng.int(20, 80),
        notoriety: 0,
      },
      inventory: [],
      weaponItemId: null,
      relationships: [],
      homeBuildingId: house?.id ?? null,
      workBuildingId: work?.id ?? null,
      currentTask: defaultTaskFor(member.vocation),
      currentIntent: null,
      bornAtTick: 0,
      diedAtTick: null,
      causeOfDeath: null,
    };
    world.pills.set(pill.id, pill);
    if (house) house.ownerPillId = pill.id;
    personalities.set(pill.id, randomPersonality(spawnRng.fork(`personality:${pill.id}`), member.soul.label, member.vocation));
    world.emit({ kind: "pill_spawned", pillId: pill.id, name: pill.name });

    // Each pill starts with food and a starter purse (extra food = grace for slow brains).
    for (let f = 0; f < 3; f++) {
      const id = nanoid(8);
      const item: Item = {
        id, kind: "food",
        name: spawnRng.pick(["bread", "apple", "groceries"]),
        position: null, ownerPillId: pill.id, potency: 0.45,
      };
      world.items.set(id, item);
      pill.inventory.push({ itemId: id, count: 1 });
    }
    // Each pill starts with a starter purse of $PILLS shards.
    const purseId = nanoid(8);
    const purse: Item = {
      id: purseId, kind: "currency", name: "$pills purse",
      position: null, ownerPillId: pill.id, potency: Math.round(spawnRng.float(15, 45)),
    };
    world.items.set(purseId, purse);
    pill.inventory.push({ itemId: purseId, count: 1 });
  });

  return world;
}
