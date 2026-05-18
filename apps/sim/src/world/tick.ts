import type { WorldEvent } from "@pumpworld/protocol";
import { Agent } from "../agents/Agent.js";
import { config } from "../config.js";
import { tickNeeds } from "./needs.js";
import { ambientSocialTick } from "./relationships.js";
import { resolveAction } from "./resolveAction.js";
import { tickIncarceration } from "./justice.js";
import { maybeSpawnFood } from "./spawner.js";
import { tickDayNight } from "./daynight.js";
import { tickExecutions } from "./executions.js";
import { tickTasks } from "./tasks.js";
import { tickPump } from "./pump.js";
import { personalities } from "./seed.js";
import { tickMarket, type MarketState } from "../token/influence.js";
import type { TokenFeed } from "../token/TokenFeed.js";
import type { World } from "./World.js";

export interface TickContext {
  agents: Map<string, Agent>;
  onBrain: (pillId: string, thought: string, intent: string | null) => void;
  tokenFeed: TokenFeed;
  marketState: MarketState;
}

/** Constitution: "Only you know your secret unless you choose to reveal it."
 *  Models routinely echo their system-prompt secret verbatim in `thought`.
 *  Strip exact-substring occurrences before the thought leaves the simulator
 *  via the brain WS channel or the persisted event log. Speech (`speak.text`)
 *  and blog posts are never redacted — those are deliberate channels and
 *  letting them through preserves the "choose to reveal it" half of the rule. */
function redactSecret(pillId: string, thought: string): string {
  const secret = personalities.get(pillId)?.secret;
  if (!secret || secret.length < 4) return thought;
  return thought.split(secret).join("[redacted secret]");
}

/**
 * Single tick:
 *   1. advance world time
 *   2. apply incarceration / passive systems
 *   3. for each pill, drain needs
 *   4. for each agent with a ready decision, resolve action
 *   5. for each agent whose think cadence has elapsed, schedule next think
 *   6. broadcast queued events
 */
export function runTick(world: World, ctx: TickContext): WorldEvent[] {
  world.meta.tick++;
  world.emit({ kind: "tick", tick: world.meta.tick });

  tickDayNight(world);
  tickMarket(world, ctx.tokenFeed, ctx.marketState);
  tickIncarceration(world);
  tickExecutions(world);
  maybeSpawnFood(world);
  tickPump(world);
  tickTasks(world);

  for (const pill of world.pills.values()) tickNeeds(world, pill);
  ambientSocialTick(world);

  // 4. apply decisions
  for (const agent of ctx.agents.values()) {
    const decision = agent.takeDecision();
    if (!decision) continue;
    const pill = world.pills.get(decision.pillId);
    if (!pill) continue;
    const safeThought = redactSecret(decision.pillId, decision.thought);
    ctx.onBrain(decision.pillId, safeThought, decision.action.kind);
    world.emit({ kind: "pill_thought", pillId: decision.pillId, text: safeThought });
    resolveAction(world, pill, decision.action);
  }

  // sleeping pills wake when energy is full
  for (const p of world.pills.values()) {
    if (p.status === "sleeping" && p.needs.energy >= 0.99) p.status = "alive";
  }

  // 5. schedule new thinks
  for (const agent of ctx.agents.values()) {
    const pill = world.pills.get(agent.pillId);
    if (!pill || pill.status === "dead" || pill.status === "exiled") continue;
    if (pill.status === "sleeping" || pill.status === "unconscious") continue;
    if (world.meta.tick - agent.lastThinkTick >= config.agentThinkEvery) {
      agent.scheduleThink(world);
    }
  }

  // 6. drain events, feed memories
  const events = world.drainEvents();
  for (const ev of events) {
    for (const agent of ctx.agents.values()) agent.recordEvent(world, ev);
  }
  return events;
}
