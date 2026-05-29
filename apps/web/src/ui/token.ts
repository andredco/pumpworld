import { BRAND_NAME } from "../brand.js";

/**
 * Token-related constants & helpers. When the token launches, the launch repo
 * sets PUMPWORLD_TOKEN_MINT etc. and we'll swap the stubbed values for live
 * Birdeye/Helius fetches. Until then we render honest "-" placeholders so
 * nobody is misled.
 */

export const TOKEN = {
  symbol: "$PILLS",
  name: BRAND_NAME,
  network: "Solana",
  /** Launch venue. */
  launchVenue: "pump.fun",
  status: "Not yet launched" as const,
  /** When launched, replace this with the real mint address. */
  mint: null as string | null,
};

export interface TokenStats {
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  priceUsd: number | null;
  holders: number | null;
}

export function emptyStats(): TokenStats {
  return { marketCapUsd: null, volume24hUsd: null, priceUsd: null, holders: null };
}

export function formatUsd(n: number | null): string {
  if (n == null) return "-";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1)             return `$${n.toFixed(2)}`;
  if (n > 0)              return `$${n.toFixed(6)}`;
  return "$0";
}

export function formatCount(n: number | null): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
