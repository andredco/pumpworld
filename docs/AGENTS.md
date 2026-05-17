# docs/AGENTS.md, for developers

The root [`AGENTS.md`](../AGENTS.md) is the in-character constitution loaded into every pill's system prompt. This file is the engineering-side counterpart: what's actually wired, where, and how to extend it without breaking the soul.

## Where the rules come from

| Concern                | File                                                  |
| ---------------------- | ----------------------------------------------------- |
| System prompt          | `apps/sim/src/agents/Agent.ts` (`SYSTEM_PROMPT`)      |
| Per-turn perception    | `apps/sim/src/agents/perception.ts`                   |
| Action schema (zod)    | `packages/protocol/src/actions.ts`                    |
| Action execution       | `apps/sim/src/world/resolveAction.ts`                 |
| Crime → trial → death  | `apps/sim/src/world/justice.ts` + `executions.ts`     |
| Daily task assignment  | `apps/sim/src/world/tasks.ts`                         |
| Day/night/temperature  | `apps/sim/src/world/daynight.ts`                      |
| Provider wiring        | `apps/sim/src/agents/providers/` (`openrouter.ts`, …) |

If you change the rules of the world, change the **system prompt and the docs/AGENTS.md at the same time**. They must stay in lockstep, or the agents will operate under one set of rules while the world enforces another and everything will feel weird.

## How a turn flows

```
   tick T begins
      │
      ├─► tickDayNight       (advance clock, season, weather, temp)
      ├─► tickIncarceration  (decrement jail sentences)
      ├─► tickExecutions     (walk condemned to gallows, kill on arrival)
      ├─► maybeSpawnFood     (keep the world fed)
      ├─► tickTasks          (per-pill task suggestion every 15 ticks)
      ├─► tickNeeds          (drain hunger / energy / social / purpose)
      ├─► ambientSocialTick  (proximity-based last-seen / affinity bumps)
      │
      ├─► for each agent with a pending decision:
      │     resolveAction(pill, decision.action)
      │
      ├─► wake any sleeper whose energy is full
      │
      ├─► for each pill whose think-cadence has elapsed:
      │     agent.scheduleThink(world)        ← non-blocking, returns immediately
      │
      └─► drain queued events to:
            • EventLog (events.jsonl on disk)
            • WebSocket subscribers
            • every Agent's memory
```

## Adding a new mechanic without breaking the agents

1. **Define the data** in `packages/protocol/src/world.ts` (or `events.ts` if it's a happening rather than a state).
2. **Emit the data** in the relevant sim module.
3. **Surface it in perception** so the agents can see it. If they can't see it, they can't react to it; the mechanic is invisible from inside.
4. **Mention it in the system prompt** if it's a *rule* (you may, you may not, this is a crime, this kills you).
5. **Update both AGENTS.md files** so the contract is documented.
6. **Smoke-test** with `npm run dev` (requires `OPENROUTER_API_KEY` and `PUMPWORLD_TOKEN_MINT` in `.env`).
7. **Render it in the viewer** so humans can see what the agents are reacting to.

## Determinism boundaries

- World gen and RNGs: deterministic from `PUMPWORLD_SEED`.
- LLM responses: non-deterministic. Replay is faithful at the *resolved-action* level (via `events.jsonl`), not at the *thought* level.
- Day/night and temperature: deterministic from `(seed, day, hour)`.
- Weather: deterministic per day from `(seed, day)`.

## Hard rails (enforced by `resolveAction.ts`, not by trust)

- Dead and exiled pills cannot act.
- Incarcerated pills can only `idle`, `speak`, or `testify`.
- Pills awaiting execution can only `idle` or `speak` (last words). The walk is automatic.
- Reach is 2.0 m. You cannot pick up, give, attack, steal, vandalize, or arson something further than that.
- Speech radius is 6 m. People further away simply don't hear you.
- Only pills with `vocation === "judge"` (and matching `judgePillId`) can `rule_verdict`.
- Only pills with `vocation === "guard"` or `"judge"` can `arrest`.

## Adding a new vocation

1. Add it to the ROSTER in `apps/sim/src/world/seed.ts` (and pick a model for it).
2. Add a workplace mapping in `seed.ts` (`vocation → BuildingKind`).
3. Add a default task line in `tasks.ts`.
4. Update `AGENTS.md` so the world acknowledges it exists.

## Adding a new building kind

1. Add the literal to `BuildingKind` in `packages/protocol/src/world.ts`.
2. Add an entry to the colour maps in `apps/web/src/three/util.ts`.
3. If it needs custom geometry, add a sub-component in `apps/web/src/three/Building.tsx` and dispatch from the top-level `Building` switch.
4. Seed at least one in `apps/sim/src/world/seed.ts`.
5. (Optional) Connect it to vocations / tasks.

## Adding a new action

1. Append a variant to `ActionSchema` in `packages/protocol/src/actions.ts`.
2. Handle it in `apps/sim/src/world/resolveAction.ts`.
3. Add the variant string to the menu in `apps/sim/src/agents/Agent.ts` (`SYSTEM_PROMPT`).
4. Document it in both `AGENTS.md` files.
