import type {
  BlogPost, Building, Incident, Item, Pill, Plot, Trial, WorldEvent, WorldMeta, WorldSnapshot,
} from "@pumpworld/protocol";

/**
 * Distributive Omit — without this, `Omit<WorldEvent, ...>` collapses the
 * discriminated union into an intersection that doesn't accept any variant.
 */
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EventInput = DistOmit<WorldEvent, "id" | "ms" | "tick"> & { tick?: number };

/**
 * The canonical, mutable world. Everything else in `apps/sim` reads & writes
 * through this object. We keep things plain (Maps + arrays) so snapshotting
 * and replays are trivial.
 */
export class World {
  meta: WorldMeta;
  pills = new Map<string, Pill>();
  items = new Map<string, Item>();
  buildings = new Map<string, Building>();
  plots = new Map<string, Plot>();
  incidents = new Map<string, Incident>();
  trials = new Map<string, Trial>();
  blogPosts = new Map<string, BlogPost>();

  /** Append-only in-memory event buffer (flushed by the event log writer). */
  pendingEvents: WorldEvent[] = [];
  private nextEventId = 1;

  constructor(meta: WorldMeta) {
    this.meta = meta;
  }

  emit(ev: EventInput): WorldEvent {
    const full = {
      ...ev,
      id: this.nextEventId++,
      tick: ev.tick ?? this.meta.tick,
      ms: Date.now(),
    } as WorldEvent;
    this.pendingEvents.push(full);
    return full;
  }

  drainEvents(): WorldEvent[] {
    const out = this.pendingEvents;
    this.pendingEvents = [];
    return out;
  }

  snapshot(): WorldSnapshot {
    return {
      meta: { ...this.meta },
      pills: [...this.pills.values()].map(p => structuredClone(p)),
      items: [...this.items.values()].map(i => structuredClone(i)),
      buildings: [...this.buildings.values()].map(b => structuredClone(b)),
      plots: [...this.plots.values()].map(p => structuredClone(p)),
      incidents: [...this.incidents.values()].map(i => structuredClone(i)),
      trials: [...this.trials.values()].map(t => structuredClone(t)),
      blogPosts: [...this.blogPosts.values()].map(b => structuredClone(b)),
    };
  }

  alivePills(): Pill[] {
    return [...this.pills.values()].filter(p => p.status !== "dead" && p.status !== "exiled");
  }
}
