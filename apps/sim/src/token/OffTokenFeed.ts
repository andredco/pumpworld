import type { TokenStats } from "@pumpworld/protocol";
import type { TokenFeed } from "./TokenFeed.js";

/** Neutral market stats when no live feed is configured (e.g. Railway smoke deploy). */
export class OffTokenFeed implements TokenFeed {
  readonly id = "off" as const;

  start(): void {}

  stop(): void {}

  current(): TokenStats {
    return {
      symbol: "$PILLS",
      mintAddress: null,
      source: "off",
      priceUsd: 0,
      marketCapUsd: 0,
      volume24hUsd: 0,
      priceChange1hPct: 0,
      priceChange24hPct: 0,
      holders: 0,
      lastUpdatedMs: Date.now(),
      spark: [],
    };
  }
}
