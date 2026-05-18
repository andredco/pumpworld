/**
 * World state primitives. The simulation server owns the canonical version;
 * the viewer receives full snapshots on connect and deltas every tick.
 */

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

export type PillId = string;
export type ItemId = string;
export type BuildingId = string;
export type PlotId = string;
export type IncidentId = string;
export type TrialId = string;
export type BlogPostId = string;

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "xai"
  | "oss"
  | "openrouter"
  | "gemini"
  | "minimax";

/** Which AI is driving a pill. */
export interface PillSoul {
  provider: ModelProvider;
  /** Routing identifier for the brain backend (not shown to viewers). */
  model: string;
  /** Display label for the viewer ("Claude", "GPT", "Grok", …). */
  label: string;
}

export type Gender = "male" | "female" | "nonbinary" | "other";

/** Cosmetic appearance — fed straight to the renderer. */
export interface PillShell {
  topColor: string;   // hex, e.g. "#ff3355"
  bottomColor: string;
  bandColor: string;
  height: number;     // metres
  radius: number;     // metres
}

export type PillStatus =
  | "alive"
  | "sleeping"
  | "unconscious"
  | "incarcerated"
  | "awaiting_execution"
  | "exiled"
  | "dead";

/** Drives moment-to-moment behaviour. All in [0,1]; high = satisfied. */
export interface Needs {
  hunger: number;
  energy: number;
  social: number;
  safety: number;
  purpose: number;
}

/** A pill's place in the world economy / state. */
export interface PillRole {
  /** Stable purpose at spawn (`farmer`, `builder`, `priest`, `merchant`, `medic`, `guard`, `judge`, `artist`, `drifter`, …). */
  vocation: string;
  /** Liquid in-world currency. */
  wealth: number;
  /** Reputation tracked by the justice system (negative = notorious). */
  notoriety: number;
}

export interface PillRelationship {
  with: PillId;
  /** -1 (hate) … +1 (love). */
  affinity: number;
  /** 0 … 1; updated by promises kept/broken. */
  trust: number;
  /** Human-readable tag the agents themselves negotiated. */
  tag: "stranger" | "acquaintance" | "friend" | "best_friend" | "lover" | "spouse" | "family" | "rival" | "enemy" | "ex";
  lastSeenTick: number;
}

export interface InventoryEntry {
  itemId: ItemId;
  count: number;
}

export interface Pill {
  id: PillId;
  name: string;
  gender: Gender;
  soul: PillSoul;
  shell: PillShell;
  position: Vec3;
  facingRad: number;
  velocity: Vec3;
  status: PillStatus;
  /** [0,1]; 0 = dead. */
  health: number;
  /** Time bomb on incarceration / exile in ticks; null otherwise. */
  sentenceTicksRemaining: number | null;
  needs: Needs;
  role: PillRole;
  inventory: InventoryEntry[];
  /** Currently held weapon item id, if any. */
  weaponItemId: ItemId | null;
  relationships: PillRelationship[];
  /** Building this pill calls home (sleeps & spawns here). */
  homeBuildingId: BuildingId | null;
  /** Building they currently work at (e.g. shop for merchant, farm for farmer). */
  workBuildingId: BuildingId | null;
  /** Short human-readable string describing what they're doing today. */
  currentTask: string;
  /** Last action the pill committed to (set by the brain, executed by the world). */
  currentIntent: string | null;
  /**
   * The world position the pill is walking toward right now, persisted between
   * brain ticks. The brain decides *where*; the body keeps walking there in
   * the background each tick so motion looks continuous instead of frozen
   * between every think. Cleared automatically when the pill arrives or when
   * the next non-movement action overrides it.
   */
  pathTarget?: Vec3 | null;
  /** Birth tick — for age/lineage. */
  bornAtTick: number;
  /** Death tick, if dead. */
  diedAtTick: number | null;
  /** Cause of death if dead. */
  causeOfDeath: string | null;
}

export type ItemKind =
  | "food"
  | "water"
  | "tool"
  | "weapon"
  | "material"
  | "currency"
  | "book"
  | "key"
  | "contraband"
  | "trinket";

export interface Item {
  id: ItemId;
  kind: ItemKind;
  name: string;
  /** Free-form world position (when not in inventory). */
  position: Vec3 | null;
  ownerPillId: PillId | null;
  /** For weapons: base damage in HP. */
  damage?: number;
  /** Calorie / hydration / utility value. */
  potency?: number;
  /** True if illegal to carry inside town limits. */
  illegal?: boolean;
}

export type BuildingKind =
  | "house"
  | "shop"
  | "tavern"
  | "temple"
  | "courthouse"
  | "town_hall"
  | "gallows"
  | "jail"
  | "farm"
  | "workshop"
  | "monument"
  | "ruin";

export type BuildingStatus = "intact" | "damaged" | "burning" | "rubble" | "under_construction";

export interface Building {
  id: BuildingId;
  kind: BuildingKind;
  name: string;
  plotId: PlotId;
  /** Bottom-centre of the footprint. */
  position: Vec3;
  /** XZ footprint extents. */
  size: { x: number; z: number };
  height: number;
  ownerPillId: PillId | null;
  occupants: PillId[];
  status: BuildingStatus;
  /** 0..1 build progress for under_construction buildings. */
  constructionProgress: number;
  /** 0..1 structural integrity. */
  integrity: number;
}

export interface Plot {
  id: PlotId;
  position: Vec3;
  size: { x: number; z: number };
  ownerPillId: PillId | null;
  buildingId: BuildingId | null;
  zoning: "residential" | "commercial" | "civic" | "agricultural" | "wild";
}

export type IncidentKind =
  | "assault"
  | "murder"
  | "theft"
  | "robbery"
  | "arson"
  | "vandalism"
  | "fraud"
  | "trespass"
  | "perjury"
  | "treason"
  | "public_disorder";

export interface Incident {
  id: IncidentId;
  kind: IncidentKind;
  tick: number;
  /** Pill who did it (best guess; the trial decides truth). */
  suspectPillId: PillId | null;
  victimPillIds: PillId[];
  witnessPillIds: PillId[];
  location: Vec3;
  /** Concrete physical effects already applied to the world. */
  description: string;
  /** Trial id if this has been brought to court. */
  trialId: TrialId | null;
  resolved: boolean;
}

export type Verdict = "guilty" | "not_guilty" | "mistrial";
export type Sentence = "none" | "fine" | "jail" | "exile" | "death";

export interface Trial {
  id: TrialId;
  incidentId: IncidentId;
  defendantPillId: PillId;
  judgePillId: PillId | null;
  startedAtTick: number;
  concludedAtTick: number | null;
  verdict: Verdict | null;
  sentence: Sentence | null;
  /** Sentence parameter: fine amount or jail ticks. */
  sentenceParam: number | null;
  /** Public log of statements: { who, what }. */
  statements: { pillId: PillId; text: string; tick: number }[];
}

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "clear" | "cloudy" | "overcast" | "rain" | "fog";

/** Snapshot of $PILLS market state. Drives the in-world Mood + Spring. */
export interface TokenStats {
  symbol: string;
  /** When set, the live feed is hitting a real on-chain mint. */
  mintAddress: string | null;
  source: "pumpfun" | "dexscreener" | "birdeye" | "off";
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  /** Price change percentage over the last 1h / 24h. */
  priceChange1hPct: number;
  priceChange24hPct: number;
  holders: number;
  /** Unix ms of the latest update. */
  lastUpdatedMs: number;
  /** A rolling sparkline of recent price values (newest last), at ~1 sample/min. */
  spark: number[];
}

/** Per-tick aggregate "vibe" the market is imposing on the town. */
export interface TokenInfluence {
  /** -1 (despair) .. +1 (euphoria). Folds 1h + 24h move + volume. */
  mood: number;
  /** 0.4 .. 2.0 multiplier on food spawn + Spring drip rate. */
  abundance: number;
  /** How charged the air feels (event probability scalar). */
  volatility: number;
}

/** Top-level world description. */
export interface WorldMeta {
  seed: string;
  /** ms per tick (wall clock target). */
  tickMs: number;
  /** Current simulation tick. */
  tick: number;
  /** Unix ms when the world started. */
  startedAtMs: number;
  /** Square world bounds [-size/2, size/2] on x & z. */
  size: number;
  /** Town centre — pills tend to gravitate here. */
  townCentre: Vec3;
  /** Ticks per in-world day (sunrise to sunrise). */
  ticksPerDay: number;
  /** In-world hour, 0..24 float. */
  hourOfDay: number;
  /** Integer days elapsed since genesis. */
  dayOfWorld: number;
  /** Current season (changes every ~7 in-world days). */
  season: Season;
  /** Current weather. */
  weather: Weather;
  /** Outside air temperature in degrees Celsius. */
  temperatureCelsius: number;
  /** Total $PILLS shards the fountain has produced since genesis. */
  pumpProducedTotal: number;
  /** $PILLS currently held by all alive pills + on the ground (excludes despawned). */
  pumpInCirculation: number;
  /**
   * Last simulated clock hour bucket when an hourly Spring drip ran.
   * bucket = dayOfWorld * 24 + floor(hourOfDay). Persisted so restarts do not
   * double-drip the same in-world hour.
   */
  pumpLastClockSlot?: number;
  /** Last in-world day when the noon tide fired (persists across restart). */
  pumpLastTideDay?: number;
  /**
   * Monotonic event-id counter. Persisted on the meta so a snapshot resume
   * does not restart at 1 and collide with ids already written to events.jsonl.
   */
  nextEventId?: number;
  /** Latest $PILLS market snapshot. */
  tokenStats: TokenStats;
  /** Derived per-tick: how the market is shaping the town right now. */
  tokenInfluence: TokenInfluence;
}

/**
 * A blog post written by a pill. Free-form channel: length and subject are chosen by the agent.
 */
export interface BlogPost {
  id: BlogPostId;
  authorPillId: PillId;
  title: string;
  body: string;
  publishedAtTick: number;
  publishedAtMs: number;
  /** Optional cover image URL (data URL or fetched). If absent, the viewer
   *  renders a procedural gradient cover seeded from the post id. */
  coverImageUrl: string | null;
  /** Generated tag list, free-form. */
  tags: string[];
}

/** Full world snapshot — used on viewer connect & for replay seek. */
export interface WorldSnapshot {
  meta: WorldMeta;
  pills: Pill[];
  items: Item[];
  buildings: Building[];
  plots: Plot[];
  incidents: Incident[];
  trials: Trial[];
  blogPosts: BlogPost[];
}
