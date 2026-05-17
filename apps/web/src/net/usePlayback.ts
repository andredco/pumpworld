import { useEffect, useRef, useState } from "react";
import type { WorldEvent } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";
import { fetchRunEvents, fetchRunMeta, fetchRunSnapshot, type RunMeta } from "./replayClient.js";

interface PlaybackOptions {
  runId: string | null;
  speed: number;       // ticks per real second of playback
  playing: boolean;
  /** When non-null, seek to this tick (and resync from nearest snapshot). */
  seekTo: number | null;
  onSeekHandled: () => void;
}

export interface PlaybackState {
  meta: RunMeta | null;
  currentTick: number;
  loading: boolean;
  error: string | null;
}

/**
 * Plays back a recorded run inside the live world store.
 *
 * Algorithm:
 *   1. Load the run meta and the nearest snapshot to (seekTo ?? 0).
 *   2. applySnapshot — clears the store and seeds it with the recorded state.
 *   3. Buffer events from snapshot tick onward in chunks.
 *   4. On a setInterval timer, apply events whose tick ≤ playhead, and
 *      advance playhead by (speed × dt).
 */
export function usePlayback(opts: PlaybackOptions): PlaybackState {
  const { runId, speed, playing, seekTo, onSeekHandled } = opts;
  const applySnapshot = useWorld(s => s.applySnapshot);
  const applyEvents = useWorld(s => s.applyEvents);

  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);

  const bufferRef = useRef<WorldEvent[]>([]);
  const headIndexRef = useRef(0);
  const playheadRef = useRef(0);
  const lastFetchEndRef = useRef(0);
  const fetchingRef = useRef(false);

  // Reload on runId change or seek.
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const m = await fetchRunMeta(runId);
        if (cancelled) return;
        setMeta(m);

        const startTick = seekTo ?? 0;
        const { snapshot, tick: snapTick } = await fetchRunSnapshot(runId, startTick);
        if (cancelled) return;
        applySnapshot(snapshot);
        playheadRef.current = snapTick;
        setCurrentTick(snapTick);

        const initialEnd = Math.min(snapTick + 600, (m.lastEventTick ?? snapTick) + 1);
        const initialEvents = await fetchRunEvents(runId, snapTick, initialEnd);
        if (cancelled) return;
        bufferRef.current = initialEvents;
        headIndexRef.current = 0;
        lastFetchEndRef.current = initialEnd;
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      } finally {
        if (seekTo != null) onSeekHandled();
      }
    })();
    return () => { cancelled = true; };
  }, [runId, seekTo, applySnapshot, onSeekHandled]);

  // Playback timer
  useEffect(() => {
    if (!playing || !runId || !meta) return;
    let raf = 0;
    let last = performance.now();
    const step = () => {
      const now = performance.now();
      const dtSec = Math.min(0.25, (now - last) / 1000);
      last = now;
      playheadRef.current += speed * dtSec;

      // Apply any events whose tick is ≤ playhead.
      const buf = bufferRef.current;
      let i = headIndexRef.current;
      const drained: WorldEvent[] = [];
      while (i < buf.length && buf[i]!.tick <= playheadRef.current) {
        drained.push(buf[i]!);
        i++;
      }
      headIndexRef.current = i;
      if (drained.length > 0) applyEvents(drained);

      setCurrentTick(Math.floor(playheadRef.current));

      // Fetch more if we're nearing the end of our buffer.
      if (
        !fetchingRef.current &&
        i > buf.length - 200 &&
        (meta.lastEventTick == null || lastFetchEndRef.current <= meta.lastEventTick)
      ) {
        fetchingRef.current = true;
        const from = lastFetchEndRef.current;
        const to = from + 1200;
        fetchRunEvents(runId, from, to).then(more => {
          bufferRef.current = [...bufferRef.current, ...more];
          lastFetchEndRef.current = to;
          fetchingRef.current = false;
        }).catch(() => { fetchingRef.current = false; });
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, runId, speed, meta, applyEvents]);

  return { meta, currentTick, loading, error };
}
