/**
 * Action vocabulary. The agent brain returns one of these per think-tick;
 * the world resolves it physically (or rejects it).
 */

import { z } from "zod";
import type { BuildingKind, ItemId, PillId, Vec3 } from "./world.js";

/** Max stored characters for blog_post body (matches resolver slice). */
export const BLOG_POST_BODY_MAX_CHARS = 16_000;

/** Strict shape produced by the AI. We validate every response. */
export const ActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("idle"), reason: z.string().max(200).optional() }),
  z.object({ kind: z.literal("speak"), to: z.string().nullable(), text: z.string().max(280) }),
  z.object({ kind: z.literal("move_to"), target: z.object({ x: z.number(), y: z.number(), z: z.number() }) }),
  z.object({ kind: z.literal("follow"), pillId: z.string() }),
  z.object({ kind: z.literal("pickup"), itemId: z.string() }),
  z.object({ kind: z.literal("drop"), itemId: z.string() }),
  z.object({ kind: z.literal("give"), itemId: z.string(), to: z.string() }),
  z.object({ kind: z.literal("eat"), itemId: z.string() }),
  z.object({ kind: z.literal("sleep") }),
  z.object({ kind: z.literal("equip_weapon"), itemId: z.string() }),
  z.object({ kind: z.literal("attack"), pillId: z.string(), intent: z.enum(["scare", "wound", "kill"]) }),
  z.object({ kind: z.literal("steal"), itemId: z.string(), from: z.string() }),
  z.object({ kind: z.literal("arson"), buildingId: z.string() }),
  z.object({ kind: z.literal("vandalize"), buildingId: z.string() }),
  z.object({ kind: z.literal("build_start"), kind_: z.string(), plotId: z.string() }),
  z.object({ kind: z.literal("build_work"), buildingId: z.string() }),
  z.object({ kind: z.literal("craft"), recipe: z.string() }),
  z.object({ kind: z.literal("pray") }),
  z.object({ kind: z.literal("propose_relationship"), pillId: z.string(), tag: z.enum(["friend", "best_friend", "lover", "spouse"]) }),
  z.object({ kind: z.literal("accuse"), suspectPillId: z.string(), incidentId: z.string() }),
  z.object({ kind: z.literal("arrest"), suspectPillId: z.string(), incidentId: z.string() }),
  z.object({ kind: z.literal("testify"), trialId: z.string(), statement: z.string().max(500) }),
  z.object({ kind: z.literal("rule_verdict"), trialId: z.string(), verdict: z.enum(["guilty", "not_guilty", "mistrial"]), sentence: z.enum(["none", "fine", "jail", "exile", "death"]), sentenceParam: z.number().int().min(0).max(100000).nullable() }),
  z.object({
    kind: z.literal("blog_post"),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(BLOG_POST_BODY_MAX_CHARS),
    tags: z.array(z.string().max(40)).max(8).optional(),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;

/** Wrapper returned by an AI brain. */
export interface AgentDecision {
  pillId: PillId;
  /** The chosen action. */
  action: Action;
  /** Free-text reasoning ("inner monologue") — shown in inspector, not in the world. */
  thought: string;
  /** Token / latency telemetry, for the dashboard. */
  meta: {
    provider: string;
    model: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

/** Convenience builder for tooling / tests. */
export const idle = (reason?: string): Action => ({ kind: "idle", reason });
export const speak = (text: string, to: PillId | null = null): Action => ({ kind: "speak", text, to });
export const moveTo = (target: Vec3): Action => ({ kind: "move_to", target });
