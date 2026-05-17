/**
 * WebSocket message envelope spoken between sim and viewers.
 * Viewers are read-only — they never send actions, only subscriptions.
 */

import type { WorldEvent } from "./events.js";
import type { Pill, PillId, WorldSnapshot } from "./world.js";

export type ServerToClient =
  | { t: "hello"; serverVersion: string; tickMs: number }
  | { t: "snapshot"; snapshot: WorldSnapshot }
  | { t: "events"; events: WorldEvent[] }
  | { t: "pill_brain"; pillId: PillId; thought: string; intent: string | null }
  | { t: "pill_patch"; pill: Pill }
  | { t: "meta_patch"; meta: import("./world.js").WorldMeta }
  | { t: "metrics"; tps: number; agentsAlive: number; queueDepth: number; tick: number };

export type ClientToServer =
  | { t: "subscribe"; channels: ("events" | "brains" | "metrics")[] }
  | { t: "request_snapshot" }
  | { t: "ping"; ms: number };
