import { create } from "zustand";
import type {
  BlogPost, Building, Incident, Item, Pill, Plot, Trial, WorldEvent, WorldMeta, WorldSnapshot,
} from "@pumpworld/protocol";

export type CameraMode = "orbit" | "overhead" | "follow" | "first_person";

interface BrainPing { thought: string; intent: string | null; ms: number }

interface WorldStore {
  connected: boolean;
  meta: WorldMeta | null;
  pills: Map<string, Pill>;
  buildings: Map<string, Building>;
  plots: Map<string, Plot>;
  items: Map<string, Item>;
  incidents: Map<string, Incident>;
  trials: Map<string, Trial>;
  blogPosts: Map<string, BlogPost>;
  /** Pulse counter that increments each time a new blog post is added — used
   *  by UI to ping a NEW badge on the navbar. */
  blogPulse: number;

  /** Most-recent-first event list for the ticker. */
  recentEvents: WorldEvent[];
  /** Per-pill last brain ping. */
  brains: Map<string, BrainPing>;
  metrics: { tps: number; agentsAlive: number; queueDepth: number; tick: number };

  selectedPillId: string | null;
  cameraMode: CameraMode;
  followPillId: string | null;

  setConnected(c: boolean): void;
  applySnapshot(s: WorldSnapshot): void;
  applyEvents(evs: WorldEvent[]): void;
  applyBrain(pillId: string, thought: string, intent: string | null): void;
  applyMetrics(m: WorldStore["metrics"]): void;
  applyMeta(meta: WorldMeta): void;

  selectPill(id: string | null): void;
  setCamera(mode: CameraMode, followPillId?: string | null): void;
}

const MAX_TICKER = 120;

export const useWorld = create<WorldStore>((set, get) => ({
  connected: false,
  meta: null,
  pills: new Map(),
  buildings: new Map(),
  plots: new Map(),
  items: new Map(),
  incidents: new Map(),
  trials: new Map(),
  blogPosts: new Map(),
  blogPulse: 0,
  recentEvents: [],
  brains: new Map(),
  metrics: { tps: 0, agentsAlive: 0, queueDepth: 0, tick: 0 },
  selectedPillId: null,
  cameraMode: "orbit",
  followPillId: null,

  setConnected: c => set({ connected: c }),

  applySnapshot: s => {
    const pills = new Map(s.pills.map(p => [p.id, p] as const));
    const buildings = new Map(s.buildings.map(b => [b.id, b] as const));
    const plots = new Map(s.plots.map(p => [p.id, p] as const));
    const items = new Map(s.items.map(i => [i.id, i] as const));
    const incidents = new Map(s.incidents.map(i => [i.id, i] as const));
    const trials = new Map(s.trials.map(t => [t.id, t] as const));
    const blogPosts = new Map((s.blogPosts ?? []).map(b => [b.id, b] as const));
    set({
      meta: s.meta,
      pills, buildings, plots, items, incidents, trials, blogPosts,
      // event ids are only unique per run — wipe the ticker on (re)connect
      recentEvents: [],
      brains: new Map(),
      blogPulse: 0,
    });
  },

  applyEvents: evs => {
    const pills = new Map(get().pills);
    const buildings = new Map(get().buildings);
    const items = new Map(get().items);
    const incidents = new Map(get().incidents);
    const trials = new Map(get().trials);
    const blogPosts = new Map(get().blogPosts);
    let meta = get().meta;
    let blogPulse = get().blogPulse;

    for (const ev of evs) {
      switch (ev.kind) {
        case "pill_moved": {
          const p = pills.get(ev.pillId);
          if (p) pills.set(p.id, { ...p, position: ev.to });
          break;
        }
        case "pill_died": {
          const p = pills.get(ev.pillId);
          if (p) pills.set(p.id, { ...p, status: "dead", health: 0, causeOfDeath: ev.cause, diedAtTick: ev.tick });
          break;
        }
        case "pill_executed": {
          const p = pills.get(ev.pillId);
          if (p) pills.set(p.id, { ...p, status: "dead", health: 0 });
          break;
        }
        case "pill_arrested": {
          const p = pills.get(ev.pillId);
          if (p) pills.set(p.id, { ...p, status: "incarcerated" });
          break;
        }
        case "pill_released": {
          const p = pills.get(ev.pillId);
          if (p) pills.set(p.id, { ...p, status: "alive" });
          break;
        }
        case "pill_exiled": {
          const p = pills.get(ev.pillId);
          if (p) pills.set(p.id, { ...p, status: "exiled" });
          break;
        }
        case "task_changed": {
          const p = pills.get(ev.pillId);
          if (p) pills.set(p.id, { ...p, currentTask: ev.task });
          break;
        }
        case "item_spawned": {
          items.set(ev.itemId, ev.item);
          break;
        }
        case "item_despawned": {
          items.delete(ev.itemId);
          break;
        }
        case "item_moved": {
          const it = items.get(ev.itemId);
          if (it) items.set(ev.itemId, { ...it, position: ev.position, ownerPillId: ev.ownerPillId });
          break;
        }
        case "building_burning": {
          const b = buildings.get(ev.buildingId);
          if (b) buildings.set(b.id, { ...b, status: "burning" });
          break;
        }
        case "building_completed": {
          const b = buildings.get(ev.buildingId);
          if (b) buildings.set(b.id, { ...b, status: "intact", constructionProgress: 1 });
          break;
        }
        case "building_destroyed": {
          const b = buildings.get(ev.buildingId);
          if (b) buildings.set(b.id, { ...b, status: "rubble", integrity: 0 });
          break;
        }
        case "weather_changed": {
          if (meta) meta = { ...meta, weather: ev.weather as WorldMeta["weather"], temperatureCelsius: ev.temperatureCelsius };
          break;
        }
        case "new_day": {
          if (meta) meta = { ...meta, dayOfWorld: ev.day, season: ev.season as WorldMeta["season"] };
          break;
        }
        case "blog_published": {
          blogPosts.set(ev.postId, ev.post);
          blogPulse += 1;
          break;
        }
        case "market_event": {
          if (meta) meta = {
            ...meta,
            tokenStats: { ...meta.tokenStats, priceUsd: ev.priceUsd, marketCapUsd: ev.marketCapUsd },
          };
          break;
        }
        case "tick":
          if (meta) meta = { ...meta, tick: ev.tick };
          break;
      }
    }

    const incomingNewestFirst = evs.slice().reverse();
    const recent = [...incomingNewestFirst, ...get().recentEvents].slice(0, MAX_TICKER);
    set({ pills, buildings, items, incidents, trials, recentEvents: recent, meta, blogPosts, blogPulse });
  },

  applyBrain: (pillId, thought, intent) => {
    const brains = new Map(get().brains);
    brains.set(pillId, { thought, intent, ms: Date.now() });
    set({ brains });
  },

  applyMetrics: m => set({ metrics: m }),

  applyMeta: meta => set({ meta }),

  selectPill: id => set({ selectedPillId: id }),
  setCamera: (mode, followPillId = null) => set({ cameraMode: mode, followPillId }),
}));
