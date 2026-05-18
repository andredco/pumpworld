import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * `dotenv/config` only reads `.env` from `process.cwd()`. In this monorepo,
 * `npm run dev -w @pumpworld/sim` often leaves cwd at `apps/sim`, while the
 * real `.env` lives at the repo root. Load root first, then package cwd.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const simPkgRoot = join(__dirname, "..");
const repoRoot = join(__dirname, "..", "..", "..");
for (const envPath of [
  join(repoRoot, ".env"),
  join(repoRoot, ".env.local"),
  join(simPkgRoot, ".env"),
  join(simPkgRoot, ".env.local"),
  join(process.cwd(), ".env"),
  join(process.cwd(), ".env.local"),
]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const num = (v: string | undefined, d: number) => {
  if (!v) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const config = {
  tickMs: num(process.env.PUMPWORLD_TICK_MS, 2000),
  agentThinkEvery: num(process.env.PUMPWORLD_AGENT_THINK_EVERY, 3),
  /** Ticks per in-world day. Default = 240 → ~8 minutes per game day at 2s ticks. */
  ticksPerDay: num(process.env.PUMPWORLD_TICKS_PER_DAY, 240),
  seed: process.env.PUMPWORLD_SEED ?? "pumpworld-genesis",
  dataDir: process.env.PUMPWORLD_DATA_DIR ?? "./data",
  /** HTTP inspector + replay API. When equal to {@link wsPort}, WebSocket upgrades share this listener (Railway `PORT`). */
  httpPort: num(process.env.PORT ?? process.env.PUMPWORLD_HTTP_PORT, 8787),
  /** Live viewer WebSocket. Defaults to 8788 locally; matches {@link httpPort} when `PORT` is set (e.g. Railway). */
  wsPort: process.env.PORT != null
    ? num(process.env.PORT, 8787)
    : num(process.env.PUMPWORLD_WS_PORT, 8788),
  /** When true, restart the world from genesis instead of resuming the latest snapshot. */
  forceFreshStart: process.env.PUMPWORLD_FRESH_START === "1",

  /**
   * Need decay per tick is multiplied by this (baseline dt=0.01 inside needs.ts).
   * Lower = slower hunger/energy drain so agents survive API latency and sparse eats.
   */
  needDrainScale: num(process.env.PUMPWORLD_NEED_DRAIN_SCALE, 0.42),
  /** Health lost per tick while hunger or energy is zero (starvation / exhaustion). */
  starvationBleedPerTick: num(process.env.PUMPWORLD_STARVATION_BLEED, 0.003),

  /**
   * Hard cap on OpenAI Chat Completions calls per minute across all pills using `provider: openai`.
   * Serializes traffic so six agents cannot spike usage. Set to 0 to disable.
   * Default ~5 keeps rough spend closer to "hours not minutes" for small credits (depends on model + prompt size).
   */
  openaiMaxCallsPerMinute: num(process.env.PUMPWORLD_OPENAI_MAX_CALLS_PER_MINUTE, 5),
  /** Max completion tokens per brain call. Raise for long blog_post JSON; lower to save cost. */
  brainMaxOutputTokens: num(process.env.PUMPWORLD_BRAIN_MAX_TOKENS, 8192),
  /**
   * Hard timeout per LLM HTTP call, in milliseconds. Without this a single
   * hung upstream wedges a pill forever (Agent.inflight stays true). 45s gives
   * slow models room to finish a long blog_post; tune via env if needed.
   */
  brainCallTimeoutMs: num(process.env.PUMPWORLD_BRAIN_CALL_TIMEOUT_MS, 45_000),
  /** LLM sampling temperature for brains (0–2). Higher = messier, more human-varied choices; lower = safer repeats. */
  brainTemperature: num(process.env.PUMPWORLD_BRAIN_TEMPERATURE, 1.08),

  token: {
    mintAddress: (process.env.PUMPWORLD_TOKEN_MINT ?? "").trim(),
    /** DexScreener polling. `auto` selects DexScreener (the only feed implementation). */
    source: (process.env.PUMPWORLD_TOKEN_FEED ?? "auto") as "auto" | "dexscreener",
    pollMs: num(process.env.PUMPWORLD_TOKEN_POLL_MS, 10_000),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY?.trim() || process.env.openai_api_key?.trim() || "",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  },
  xai: {
    apiKey: process.env.XAI_API_KEY ?? "",
  },
  oss: {
    baseUrl: process.env.OSS_BASE_URL ?? "",
    apiKey: process.env.OSS_API_KEY ?? "",
    model: process.env.OSS_MODEL ?? "",
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    /** Optional default model fallback. */
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL ?? "meta-llama/llama-3.1-8b-instruct",
    /** Headers OpenRouter recommends for analytics. */
    appUrl: process.env.OPENROUTER_APP_URL ?? "https://pill.world",
    appTitle: process.env.OPENROUTER_APP_TITLE ?? "Pill World",
  },
  /** Google AI Studio / Gemini Developer API (AIza… keys). */
  gemini: {
    apiKey:
      process.env.GEMINI_API_KEY?.trim()
      || process.env.gemini_api_key?.trim()
      || process.env.GOOGLE_AI_API_KEY?.trim()
      || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
      || "",
    /** Override for Vertex or testing (default: Gemini Developer API v1beta). */
    apiBase: process.env.GEMINI_API_BASE_URL?.trim() || "",
    /**
     * Sliding-window cap on generateContent calls per model per minute (Gemini only).
     * Free tier is often ~5 RPM / ~20 RPD per model; six parallel pills easily exceed that.
     * Set to 0 to disable throttling.
     */
    maxCallsPerMinute: num(process.env.PUMPWORLD_GEMINI_MAX_CALLS_PER_MINUTE, 4),
    /** After HTTP 429 / RESOURCE_EXHAUSTED, retry up to this many extra attempts with backoff. */
    maxRetries429: num(process.env.PUMPWORLD_GEMINI_MAX_RETRIES_429, 4),
  },
  /** MiniMax platform API (Bearer key). OpenAI-compatible `/v1/chat/completions`. */
  minimax: {
    apiKey: process.env.MINIMAX_API_KEY?.trim() || process.env.minimax_api_key?.trim() || "",
    apiBase: process.env.MINIMAX_API_BASE_URL?.trim() || "https://api.minimax.io/v1",
  },
} as const;

export const SERVER_VERSION = "0.1.0";

/** Sampling temperature for chat APIs that accept 0–2 (OpenAI-style, Gemini, OpenRouter, MiniMax). */
export function brainSamplingTemperature(): number {
  return Math.min(2, Math.max(0, config.brainTemperature));
}

/** Anthropic Messages API only documents 0–1. */
export function brainSamplingTemperatureAnthropic(): number {
  return Math.min(1, Math.max(0, config.brainTemperature));
}
