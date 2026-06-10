/**
 * Pluggable source of $SOULS market state.
 *
 * Production wiring uses {@link DexScreenerFeed}; implement this interface for
 * additional venues (Birdeye, pump.fun RPC, etc.).
 */

import type { TokenStats } from "@pumpworld/protocol";

export interface TokenFeed {
  readonly id: "dexscreener" | "pumpfun" | "birdeye" | "off";
  start(): void;
  stop(): void;
  /** Latest snapshot; called once per sim tick. */
  current(): TokenStats;
}
