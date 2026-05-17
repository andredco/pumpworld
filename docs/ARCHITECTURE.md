# Architecture

## 30-second mental model

```
              ┌───────────────────────────────────────────────────────┐
              │                      apps/sim (Node)                  │
              │                                                       │
   AI APIs ◄──┼── providers/  ── Agent.scheduleThink (async per pill) │
 (Claude /    │                       │                               │
  GPT / Grok/ │                       ▼                               │
  OSS / …)    │             Agent.pendingDecision                     │
              │                       │                               │
              │   tick loop ──► runTick ──► resolveAction ──► World   │
              │        │                                              │
              │        ├──► EventLog (JSONL, append-only)             │
              │        └──► WsBroadcaster ─── events / snapshots ───┐ │
              │                                                     │ │
              └─────────────────────────────────────────────────────┼─┘
                                                                    │
                                                                    ▼
                                                ┌──────────────────────────┐
                                                │   apps/web (React+R3F)   │
                                                │                          │
                                                │  WebSocket ─► Zustand    │
                                                │     │                    │
                                                │     ▼                    │
                                                │  Scene / HUD / Inspector │
                                                └──────────────────────────┘
```

## Why authoritative server

The sim is the only source of truth. Viewers are pure consumers, they can never affect state. This:

1. Keeps the world consistent for everyone.
2. Lets us write a perfect replay (event log + initial seed).
3. Stops cheating, doxxing of internal IDs, or prompt-injection from the page.

## Tick loop

A fixed wall-clock timer fires every `PUMPWORLD_TICK_MS` (default 2 s). Each tick:

1. Increment tick counter (`world.meta.tick`).
2. Decrement jail sentences (`tickIncarceration`).
3. Drain physiological needs (`tickNeeds`), starvation/exhaustion can kill.
4. Apply ambient social proximity bumps (`ambientSocialTick`).
5. Apply any `pendingDecision` from each `Agent` (one action per pill).
6. Sleeping pills wake when energy is full.
7. Schedule new `Agent.scheduleThink()` calls for pills whose cadence has elapsed (every `PUMPWORLD_AGENT_THINK_EVERY` ticks).
8. Drain the world's event queue → write to `EventLog`, broadcast over WebSocket, fold into each agent's memory.

The think step is **fully asynchronous and non-blocking**: slow models (Claude, large OSS models) don't stall the tick. Their decision simply lands a tick or two later. This keeps the simulation buttery even when one provider has hiccups.

## Determinism

Determinism is best-effort, not strict:

- World generation, RNGs: fully deterministic from `PUMPWORLD_SEED`.
- LLM providers: non-deterministic in practice even with `seed`. The replay log captures all *resolved actions and their effects*, so the replay is faithful even if you can't re-roll the same think.

## Replay

Each `sim` run writes to `data/<timestamp>__<seed>/`:

- `events.jsonl`, every `WorldEvent`, line-delimited JSON.
- `tick-NNNNNNNN.snapshot.json`, full world dumps every 300 ticks (and on shutdown).

The viewer's `applySnapshot` + `applyEvents` is already the engine you'd use to replay; a future `apps/replay` is just a small driver that reads a directory and pumps the WebSocket.

## Protocol shapes

See `packages/protocol/src/`. The contract between sim and viewer is:

- `WorldSnapshot`, sent on connect and on every snapshot tick.
- `WorldEvent[]`, sent every world tick (deltas).
- `ServerToClient.pill_brain`, out-of-band stream of inner monologue per think.
- `ServerToClient.metrics`. TPS, alive count, queue depth.

Adding a new mechanic = add types in `protocol`, emit the event in `sim`, render it in `web`. That ordering is enforced by TypeScript across the workspace.

## Where to extend

| You want to add…           | Touch…                                                |
| -------------------------- | ----------------------------------------------------- |
| A new action               | `protocol/actions.ts` (schema) + `sim/world/resolveAction.ts` + `sim/agents/Agent.ts` (system prompt) |
| A new event                | `protocol/events.ts` + emit somewhere in sim + render in `web/ui/EventTicker.tsx` and `web/store/worldStore.ts` |
| A new AI provider          | `sim/agents/providers/<name>.ts` + register in `sim/agents/providers/index.ts` |
| A new building / mechanic  | `protocol/world.ts` + seed it in `sim/world/seed.ts` + render in `web/three/Building.tsx` (or new component) |
| A new camera mode          | `web/three/Scene.tsx` `CameraRig` + `web/ui/CameraSwitcher.tsx` |
