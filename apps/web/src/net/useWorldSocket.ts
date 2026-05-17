import { useEffect } from "react";
import type { ServerToClient } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";

export function useWorldSocket(url: string = __PUMPWORLD_WS__): void {
  const setConnected = useWorld(s => s.setConnected);
  const applySnapshot = useWorld(s => s.applySnapshot);
  const applyEvents = useWorld(s => s.applyEvents);
  const applyBrain = useWorld(s => s.applyBrain);
  const applyMetrics = useWorld(s => s.applyMetrics);
  const applyMeta = useWorld(s => s.applyMeta);

  useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;
    let backoffMs = 500;

    const connect = () => {
      if (!alive) return;
      ws = new WebSocket(url);
      ws.onopen = () => {
        setConnected(true);
        backoffMs = 500;
        ws?.send(JSON.stringify({ t: "subscribe", channels: ["events", "brains", "metrics"] }));
        ws?.send(JSON.stringify({ t: "request_snapshot" }));
      };
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data) as ServerToClient;
          switch (msg.t) {
            case "snapshot":  applySnapshot(msg.snapshot); break;
            case "events":    applyEvents(msg.events); break;
            case "pill_brain":applyBrain(msg.pillId, msg.thought, msg.intent); break;
            case "metrics":   applyMetrics({ tps: msg.tps, agentsAlive: msg.agentsAlive, queueDepth: msg.queueDepth, tick: msg.tick }); break;
            case "meta_patch": applyMeta(msg.meta); break;
            case "hello":     break;
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!alive) return;
        setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 1.7, 5000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => { alive = false; ws?.close(); };
  }, [url, setConnected, applySnapshot, applyEvents, applyBrain, applyMetrics]);
}
