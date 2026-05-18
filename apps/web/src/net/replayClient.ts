/**
 * Tiny REST client for the sim's run-recording API. The sim writes every
 * world tick into `data/<run>/events.jsonl` plus periodic snapshots; we
 * read them back here to play recordings inside the same scene engine.
 */

import type { WorldEvent, WorldSnapshot } from "@pumpworld/protocol";
import { HTTP_BASE } from "../runtimeConfig.js";

const BASE = HTTP_BASE;

export interface RunSummary {
  id: string;
  startedAt: string;
  seed: string;
  isLive: boolean;
  eventBytes: number;
  snapshots: number[];
  lastEventTick: number | null;
}

export interface RunMeta {
  id: string;
  startedAt: string;
  seed: string;
  snapshots: number[];
  lastEventTick: number | null;
  eventBytes: number;
}

export async function listRuns(): Promise<RunSummary[]> {
  const r = await fetch(`${BASE}/runs`);
  if (!r.ok) throw new Error(`/runs ${r.status}`);
  return r.json();
}

export async function fetchRunMeta(id: string): Promise<RunMeta> {
  const r = await fetch(`${BASE}/run/${encodeURIComponent(id)}/meta`);
  if (!r.ok) throw new Error(`run meta ${r.status}`);
  return r.json();
}

export async function fetchRunSnapshot(id: string, tick?: number): Promise<{ snapshot: WorldSnapshot; tick: number }> {
  const url = tick != null
    ? `${BASE}/run/${encodeURIComponent(id)}/snapshot?tick=${tick}`
    : `${BASE}/run/${encodeURIComponent(id)}/snapshot`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`snapshot ${r.status}`);
  const snapshot = await r.json() as WorldSnapshot;
  const headerTick = Number(r.headers.get("x-snapshot-tick") ?? snapshot.meta.tick);
  return { snapshot, tick: Number.isFinite(headerTick) ? headerTick : snapshot.meta.tick };
}

export async function fetchRunEvents(id: string, from: number, to?: number): Promise<WorldEvent[]> {
  const url = to != null
    ? `${BASE}/run/${encodeURIComponent(id)}/events?from=${from}&to=${to}`
    : `${BASE}/run/${encodeURIComponent(id)}/events?from=${from}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`events ${r.status}`);
  const text = await r.text();
  if (!text.trim()) return [];
  return text.trim().split("\n").map(line => JSON.parse(line) as WorldEvent);
}
