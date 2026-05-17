/**
 * Event log. Everything that happens in the world is appended here as a
 * structured event. The log + initial seed = full replay.
 */

import type {
  BlogPost, BlogPostId, BuildingId, IncidentId, IncidentKind, Item, ItemId, PillId, Sentence, TrialId, Vec3, Verdict,
} from "./world.js";

interface EventBase {
  /** Monotonic id. */
  id: number;
  tick: number;
  /** Unix ms when the event was committed. */
  ms: number;
}

export type WorldEvent =
  | (EventBase & { kind: "world_started"; seed: string })
  | (EventBase & { kind: "pill_spawned"; pillId: PillId; name: string })
  | (EventBase & { kind: "pill_moved"; pillId: PillId; from: Vec3; to: Vec3 })
  | (EventBase & { kind: "pill_spoke"; pillId: PillId; to: PillId | null; text: string })
  | (EventBase & { kind: "pill_thought"; pillId: PillId; text: string })
  | (EventBase & { kind: "pill_slept"; pillId: PillId; ticks: number })
  | (EventBase & { kind: "pill_ate"; pillId: PillId; itemId: ItemId; gainedHunger: number })
  | (EventBase & { kind: "pill_picked_up"; pillId: PillId; itemId: ItemId })
  | (EventBase & { kind: "pill_dropped"; pillId: PillId; itemId: ItemId })
  | (EventBase & { kind: "pill_gave"; pillId: PillId; itemId: ItemId; to: PillId })
  | (EventBase & { kind: "pill_equipped"; pillId: PillId; itemId: ItemId })
  | (EventBase & { kind: "pill_attacked"; pillId: PillId; targetPillId: PillId; intent: "scare" | "wound" | "kill"; damage: number })
  | (EventBase & { kind: "pill_died"; pillId: PillId; cause: string; killerPillId: PillId | null })
  | (EventBase & { kind: "pill_arrested"; pillId: PillId; byPillId: PillId; incidentId: IncidentId })
  | (EventBase & { kind: "pill_released"; pillId: PillId })
  | (EventBase & { kind: "pill_exiled"; pillId: PillId })
  | (EventBase & { kind: "pill_executed"; pillId: PillId; trialId: TrialId | null })
  | (EventBase & { kind: "weather_changed"; weather: string; temperatureCelsius: number })
  | (EventBase & { kind: "new_day"; day: number; season: string })
  | (EventBase & { kind: "task_changed"; pillId: PillId; task: string })
  | (EventBase & { kind: "pump_dripped"; itemIds: ItemId[]; amount: number })
  | (EventBase & { kind: "pump_tide"; itemIds: ItemId[]; amount: number })
  | (EventBase & { kind: "blog_published"; postId: BlogPostId; authorPillId: PillId; title: string; post: BlogPost })
  | (EventBase & { kind: "market_event"; subtype: "pump" | "dump" | "whale_buy" | "whale_sell" | "ath" | "atl"; magnitude: number; priceUsd: number; marketCapUsd: number; message: string })
  | (EventBase & { kind: "relationship_changed"; pillId: PillId; with: PillId; tag: string; affinity: number; trust: number })
  | (EventBase & { kind: "incident_logged"; incidentId: IncidentId; incidentKind: IncidentKind; suspectPillId: PillId | null })
  | (EventBase & { kind: "trial_started"; trialId: TrialId; incidentId: IncidentId; defendantPillId: PillId; judgePillId: PillId | null })
  | (EventBase & { kind: "trial_statement"; trialId: TrialId; pillId: PillId; text: string })
  | (EventBase & { kind: "trial_concluded"; trialId: TrialId; verdict: Verdict; sentence: Sentence; sentenceParam: number | null })
  | (EventBase & { kind: "building_started"; buildingId: BuildingId; ownerPillId: PillId })
  | (EventBase & { kind: "building_progress"; buildingId: BuildingId; progress: number })
  | (EventBase & { kind: "building_completed"; buildingId: BuildingId })
  | (EventBase & { kind: "building_burning"; buildingId: BuildingId; arsonistPillId: PillId | null })
  | (EventBase & { kind: "building_destroyed"; buildingId: BuildingId })
  | (EventBase & { kind: "item_spawned"; itemId: ItemId; item: Item })
  | (EventBase & { kind: "item_despawned"; itemId: ItemId })
  | (EventBase & { kind: "item_moved"; itemId: ItemId; position: Vec3 | null; ownerPillId: PillId | null })
  | (EventBase & { kind: "tick"; tick: number });

export type WorldEventKind = WorldEvent["kind"];
