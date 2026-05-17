import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import type { ClientToServer, ServerToClient, WorldEvent, WorldSnapshot } from "@pumpworld/protocol";
import { SERVER_VERSION } from "../config.js";

interface ClientState {
  ws: WebSocket;
  channels: Set<"events" | "brains" | "metrics">;
}

export type WsBroadcasterOptions =
  | { port: number; onError: (err: Error) => void }
  | { server: Server; onError: (err: Error) => void };

export class WsBroadcaster {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, ClientState>();
  /** Last full snapshot we sent to all clients (for `broadcastSnapshot`). */
  private lastSnapshot: WorldSnapshot | null = null;
  /** Live getter — used for new clients so they never see a stale world. */
  private snapshotProvider: () => WorldSnapshot = () => {
    if (this.lastSnapshot) return this.lastSnapshot;
    throw new Error("snapshotProvider not configured");
  };

  constructor(opts: WsBroadcasterOptions) {
    this.wss = "server" in opts
      ? new WebSocketServer({ server: opts.server })
      : new WebSocketServer({ port: opts.port });
    this.wss.on("connection", ws => this.onConnection(ws));
    this.wss.on("error", err => opts.onError(err));
  }

  /** Call once at boot — gives the WS server a live view of world state. */
  setSnapshotProvider(fn: () => WorldSnapshot) { this.snapshotProvider = fn; }

  /** Optional: stash the latest snapshot so we can rebroadcast it cheaply. */
  setSnapshot(snap: WorldSnapshot) { this.lastSnapshot = snap; }

  get port(): number {
    const addr = this.wss.address();
    if (addr == null || typeof addr === "string") return 0;
    return addr.port;
  }
  get clientCount() { return this.clients.size; }

  private onConnection(ws: WebSocket) {
    const state: ClientState = { ws, channels: new Set(["events", "metrics"]) };
    this.clients.set(ws, state);
    let snap: WorldSnapshot | null = null;
    try { snap = this.snapshotProvider(); } catch { snap = this.lastSnapshot; }
    this.send(ws, { t: "hello", serverVersion: SERVER_VERSION, tickMs: snap?.meta.tickMs ?? 2000 });
    if (snap) this.send(ws, { t: "snapshot", snapshot: snap });
    ws.on("message", buf => {
      try {
        const msg = JSON.parse(buf.toString()) as ClientToServer;
        this.onMessage(state, msg);
      } catch { /* ignore malformed */ }
    });
    ws.on("close", () => this.clients.delete(ws));
    ws.on("error", () => this.clients.delete(ws));
  }

  private onMessage(state: ClientState, msg: ClientToServer) {
    switch (msg.t) {
      case "subscribe":
        state.channels = new Set(msg.channels);
        return;
      case "request_snapshot": {
        let snap: WorldSnapshot | null = null;
        try { snap = this.snapshotProvider(); } catch { snap = this.lastSnapshot; }
        if (snap) this.send(state.ws, { t: "snapshot", snapshot: snap });
        return;
      }
      case "ping":
        return;
    }
  }

  broadcastEvents(events: WorldEvent[]) {
    if (events.length === 0) return;
    const msg: ServerToClient = { t: "events", events };
    const json = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.channels.has("events")) c.ws.send(json);
    }
  }

  broadcastBrain(pillId: string, thought: string, intent: string | null) {
    const msg: ServerToClient = { t: "pill_brain", pillId, thought, intent };
    const json = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.channels.has("brains")) c.ws.send(json);
    }
  }

  broadcastMetrics(tps: number, agentsAlive: number, queueDepth: number, tick: number) {
    const msg: ServerToClient = { t: "metrics", tps, agentsAlive, queueDepth, tick };
    const json = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.channels.has("metrics")) c.ws.send(json);
    }
  }

  broadcastMeta(meta: import("@pumpworld/protocol").WorldMeta) {
    const msg: ServerToClient = { t: "meta_patch", meta };
    const json = JSON.stringify(msg);
    for (const c of this.clients.values()) c.ws.send(json);
  }

  broadcastSnapshot(snapshot: WorldSnapshot) {
    this.lastSnapshot = snapshot;
    const msg: ServerToClient = { t: "snapshot", snapshot };
    const json = JSON.stringify(msg);
    for (const c of this.clients.values()) c.ws.send(json);
  }

  private send(ws: WebSocket, msg: ServerToClient) {
    try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
  }

  async close() {
    await new Promise<void>(res => this.wss.close(() => res()));
  }
}
