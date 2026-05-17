/**
 * Live $PILLS market feed via DexScreener's public API.
 *
 * Endpoint: https://api.dexscreener.com/latest/dex/tokens/{mintAddress}
 *   - free, no API key required
 *   - rate limit: ~300 requests per minute per IP (we poll every 10s, well under)
 *   - returns a list of trading pairs across all DEXes; we pick the most
 *     liquid Solana pair (the pump.fun bonding curve while pre-graduation,
 *     the Raydium pair once it has graduated)
 *
 * Pump.fun bonding-curve trading is documented for on-chain integrators; those references focus on instructions and accounts, not a hosted REST quote API.
 * If your token is so freshly launched that DexScreener hasn't indexed it
 * yet (rare, usually < a minute), you can fall back to reading the
 * BondingCurve PDA directly via Helius RPC and computing
 * `price = virtual_quote_reserves / virtual_token_reserves`. That code
 * lives in `OnchainPumpFeed.ts` as a stub for when it's needed.
 */

import type { TokenStats } from "@pumpworld/protocol";
import type { TokenFeed } from "./TokenFeed.js";

interface DSPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  priceUsd?: string;
  priceChange?: { h1?: number; h24?: number };
  marketCap?: number;
  fdv?: number;
  volume?: { h24?: number; h1?: number };
  liquidity?: { usd?: number };
  baseToken?: { address: string };
}

interface DSResponse {
  pairs?: DSPair[];
}

export class DexScreenerFeed implements TokenFeed {
  readonly id = "dexscreener" as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private spark: number[] = [];
  private state: TokenStats;
  private inflight = false;
  /** Last known holder count — DexScreener doesn't return this so we leave it
   *  at the last seed value until a richer feed (Helius) is plugged in. */
  private holdersOverride: number | null = null;

  constructor(
    private readonly mintAddress: string,
    private readonly pollEveryMs = 10_000,
    initialHolders = 0,
  ) {
    this.holdersOverride = initialHolders > 0 ? initialHolders : null;
    this.state = {
      symbol: "$PILLS",
      mintAddress,
      source: "dexscreener",
      priceUsd: 0,
      marketCapUsd: 0,
      volume24hUsd: 0,
      priceChange1hPct: 0,
      priceChange24hPct: 0,
      holders: initialHolders,
      lastUpdatedMs: 0,
      spark: [],
    };
  }

  start() {
    if (this.timer) return;
    // Fire immediately so the world isn't sitting at zero on boot.
    this.poll().catch(err => console.error("[dexscreener] initial poll failed:", err.message));
    this.timer = setInterval(() => {
      this.poll().catch(err => console.error("[dexscreener] poll failed:", err.message));
    }, this.pollEveryMs);
  }
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  current(): TokenStats {
    return { ...this.state, spark: [...this.spark] };
  }

  setHolders(count: number) {
    this.holdersOverride = count;
    this.state.holders = count;
  }

  private async poll() {
    if (this.inflight) return;
    this.inflight = true;
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(this.mintAddress)}`;
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json() as DSResponse;
      const pair = pickBestPair(json.pairs ?? []);
      if (!pair) {
        // No pair indexed yet — keep last known state but mark stale.
        return;
      }
      const priceUsd = Number(pair.priceUsd ?? 0);
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) return;
      const mcap = pair.marketCap ?? pair.fdv ?? 0;
      const vol24 = pair.volume?.h24 ?? 0;
      const ch1h = pair.priceChange?.h1 ?? 0;
      const ch24h = pair.priceChange?.h24 ?? 0;

      this.spark.push(priceUsd);
      if (this.spark.length > 60) this.spark.shift();

      this.state = {
        symbol: "$PILLS",
        mintAddress: this.mintAddress,
        source: "dexscreener",
        priceUsd,
        marketCapUsd: mcap,
        volume24hUsd: vol24,
        priceChange1hPct: round(ch1h, 2),
        priceChange24hPct: round(ch24h, 2),
        holders: this.holdersOverride ?? this.state.holders,
        lastUpdatedMs: Date.now(),
        spark: [...this.spark],
      };
    } finally {
      this.inflight = false;
    }
  }
}

/** Prefer the Solana pair with the deepest USD liquidity. */
function pickBestPair(pairs: DSPair[]): DSPair | null {
  const sol = pairs.filter(p => p.chainId === "solana");
  if (sol.length === 0) return null;
  sol.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  return sol[0] ?? null;
}

function round(x: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(x * f) / f;
}
