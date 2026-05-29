/**
 * Derives the per-tick "vibe" the market is imposing on The Pill Experiment and
 * fires market_event broadcasts on threshold crossings.
 *
 * The whole point of this module: real-world $PILLS buyers literally make
 * the town richer and happier; sellers make it darker and hungrier. Pills
 * cannot see the market — they only feel its weather.
 */

import type { TokenInfluence, TokenStats } from "@pumpworld/protocol";
import type { World } from "../world/World.js";
import type { TokenFeed } from "./TokenFeed.js";

export interface MarketState {
  lastPumpFireMs: number;
  lastDumpFireMs: number;
  lastWhaleFireMs: number;
  athPrice: number;
  atlPrice: number;
}

export function newMarketState(): MarketState {
  return {
    lastPumpFireMs: 0,
    lastDumpFireMs: 0,
    lastWhaleFireMs: 0,
    athPrice: 0,
    atlPrice: Infinity,
  };
}

/**
 * Volume floors for confidence weighting.
 *
 * QUIET_FLOOR_USD: below this, % moves are pure noise (a single trader
 *   bouncing a token). We don't fade to zero — that turned the entire
 *   weather system off on day-1 launches when 24h volume was sub-$2k.
 *   A small base confidence (BASELINE_CONFIDENCE) keeps the world tinted
 *   even when the orderbook is sleepy.
 *
 * VOLUME_FULL_USD: above this, the market is loud enough that we trust the
 *   move at full weight. Tuned for an early-stage pump.fun launch — lower
 *   than a "real" market would need, because at $50k+ volume the world
 *   should already feel the move strongly.
 *
 * BASELINE_CONFIDENCE: floor on confidence so a working DexScreener feed
 *   never produces flat-zero mood. With confidence=0.25 a 25% pump still
 *   produces mood ≈ 0.25, which is enough to flip the perception line
 *   from "uncertain" to "rising" and matters in pills' system prompt.
 */
const QUIET_FLOOR_USD = 200;
const VOLUME_FULL_USD = 25_000;
const BASELINE_CONFIDENCE = 0.25;

export function deriveInfluence(stats: TokenStats): TokenInfluence {
  const c1h = stats.priceChange1hPct;
  const c24h = stats.priceChange24hPct;
  const vol = stats.volume24hUsd;

  // Confidence in the move = how much volume is behind it (0..1). When the
  // market is dead-quiet, mood swings are weighted down toward neutral but
  // never zero — even a tiny token deserves *some* weather.
  const volumeConfidence = clamp(
    (vol - QUIET_FLOOR_USD) / (VOLUME_FULL_USD - QUIET_FLOOR_USD),
    0, 1,
  );
  const confidence = clamp(BASELINE_CONFIDENCE + (1 - BASELINE_CONFIDENCE) * volumeConfidence, 0, 1);

  // Mood: weighted blend of 1h and 24h moves, faded by confidence.
  // ±25% with full confidence → ±1. Quiet markets stay calm.
  const moodRaw = ((c1h * 0.6 + c24h * 0.4) / 25) * confidence;
  const mood = clamp(moodRaw, -1, 1);

  // Abundance: 1 = neutral baseline. Positive mood adds; volume always adds
  // a small amount (a busy market = an alive town). Hard floor at 0.55 so
  // even a brutal bear market keeps food on the table.
  const volumeBoost = Math.min(0.35, vol / 250_000);
  const abundance = clamp(1 + mood * 0.55 + volumeBoost, 0.55, 2.0);

  // Volatility scales event probability. Quiet markets → quiet events.
  const volatility = clamp((Math.abs(c1h) + Math.abs(c24h)) / 50 * (0.3 + 0.7 * confidence), 0, 1);

  return {
    mood: round(mood, 3),
    abundance: round(abundance, 3),
    volatility: round(volatility, 3),
  };
}

/**
 * Update world.meta.tokenStats / tokenInfluence and fire market_event when
 * a threshold is crossed. Designed to be called once per sim tick.
 */
export function tickMarket(world: World, feed: TokenFeed, state: MarketState): void {
  const stats = feed.current();
  world.meta.tokenStats = stats;
  world.meta.tokenInfluence = deriveInfluence(stats);

  // ATH / ATL tracking
  const now = Date.now();
  if (stats.priceUsd > state.athPrice) {
    const prev = state.athPrice;
    state.athPrice = stats.priceUsd;
    if (prev > 0 && stats.priceUsd > prev * 1.0001) {
      world.emit({
        kind: "market_event",
        subtype: "ath",
        magnitude: stats.priceUsd - prev,
        priceUsd: stats.priceUsd,
        marketCapUsd: stats.marketCapUsd,
        message: `NEW ALL-TIME HIGH — $PILLS at $${stats.priceUsd.toExponential(2)} (mcap ${fmtUsd(stats.marketCapUsd)})`,
      });
    }
  }
  if (stats.priceUsd > 0 && stats.priceUsd < state.atlPrice) {
    state.atlPrice = stats.priceUsd;
  }

  // Below the quiet floor, % moves are pure noise — don't fire BIG events
  // (PUMP/DUMP/WHALE bullhorn lines). Mood weather still applies above via
  // BASELINE_CONFIDENCE; this just prevents an empty orderbook from spamming
  // "WHALE HAS SURFACED" because one wallet sneezed.
  if (stats.volume24hUsd < QUIET_FLOOR_USD) return;

  // PUMP — sustained 24h change ≥ +25% (cooldown 5 minutes)
  if (stats.priceChange24hPct >= 25 && now - state.lastPumpFireMs > 300_000) {
    state.lastPumpFireMs = now;
    world.emit({
      kind: "market_event",
      subtype: "pump",
      magnitude: stats.priceChange24hPct,
      priceUsd: stats.priceUsd,
      marketCapUsd: stats.marketCapUsd,
      message: `THE SPRING GUSHES — $PILLS +${stats.priceChange24hPct.toFixed(1)}% (24h)`,
    });
  }
  // DUMP — sustained 24h change ≤ -25%
  if (stats.priceChange24hPct <= -25 && now - state.lastDumpFireMs > 300_000) {
    state.lastDumpFireMs = now;
    world.emit({
      kind: "market_event",
      subtype: "dump",
      magnitude: stats.priceChange24hPct,
      priceUsd: stats.priceUsd,
      marketCapUsd: stats.marketCapUsd,
      message: `THE SPRING RUNS LOW — $PILLS ${stats.priceChange24hPct.toFixed(1)}% (24h)`,
    });
  }
  // WHALE — 1h change crosses ±20% (positive = whale buy, negative = whale sell), cooldown 2 minutes
  if (Math.abs(stats.priceChange1hPct) >= 20 && now - state.lastWhaleFireMs > 120_000) {
    state.lastWhaleFireMs = now;
    const buy = stats.priceChange1hPct > 0;
    world.emit({
      kind: "market_event",
      subtype: buy ? "whale_buy" : "whale_sell",
      magnitude: stats.priceChange1hPct,
      priceUsd: stats.priceUsd,
      marketCapUsd: stats.marketCapUsd,
      message: buy
        ? `A WHALE HAS SURFACED — $PILLS +${stats.priceChange1hPct.toFixed(1)}% in the last hour`
        : `THE WHALE HAS SOLD — $PILLS ${stats.priceChange1hPct.toFixed(1)}% in the last hour`,
    });
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round(x: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(x * f) / f;
}
function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
