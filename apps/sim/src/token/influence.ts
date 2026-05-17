/**
 * Derives the per-tick "vibe" the market is imposing on Pill World and
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
 * Volume floor below which we consider the market "too quiet to read" —
 * any % move with so little volume behind it is noise, not a signal. We
 * fade mood toward neutral. Tuned for a pump.fun bonding-curve baseline
 * where a sub-$10k launch can fluctuate wildly on a single trade.
 */
const QUIET_FLOOR_USD = 2_000;
const VOLUME_FULL_USD = 50_000;

export function deriveInfluence(stats: TokenStats): TokenInfluence {
  const c1h = stats.priceChange1hPct;
  const c24h = stats.priceChange24hPct;
  const vol = stats.volume24hUsd;

  // Confidence in the move = how much volume is behind it (0..1). When the
  // market is dead-quiet, mood swings are suppressed toward neutral.
  const confidence = clamp(
    (vol - QUIET_FLOOR_USD) / (VOLUME_FULL_USD - QUIET_FLOOR_USD),
    0, 1,
  );

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

  // Below the quiet floor, % moves are noise — don't fire events at all.
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
