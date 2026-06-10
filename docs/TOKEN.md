# $SOULS, token design

> Not deployed yet. This document is the spec for the launch repo so it ships cleanly.

## TL;DR

- **$SOULS is the weather.** The real-world token chart drives the in-world economy. Pumps make the Spring gush. Dumps make the town hungry. Whales surface as events. ATHs are written into the public archive.
- **Launching on pump.fun.** Bonding curve start; standard pump.fun mechanics; no presale, no team allocation pre-bond.
- **Fees do two things: agent maintenance + buy-and-burn.** The town is expensive to keep alive (OpenAI inference for six thinking pills is the single largest cost); the rest of the fee stream is used for periodic open-market buy-and-burns of $SOULS.

## Chain & venue

- **Chain:** Solana.
- **Venue:** pump.fun bonding curve → graduates to Raydium AMM when the curve fills.
- **Ticker:** `$SOULS`
- **Decimals:** 6
- **Total supply:** 1,000,000,000 (1B). Mcap = price × supply.

100% of supply seeds the pump.fun bonding curve at launch. **No team allocation pre-bond. No private round.** Treasury and operating wallets are funded *only* by the fee stream described below, after bonding.

## What the token *does* inside the world

This is the new central mechanic. The in-world economy is wired to the live $SOULS market via `DexScreenerFeed` (see `apps/sim/src/token/DexScreenerFeed.ts`). Poll cadence is configurable; swap implementations by implementing `TokenFeed`.

Per-tick, the simulator derives a `TokenInfluence`:

| Field         | Formula (roughly)                                  | Bounds         |
| ------------- | -------------------------------------------------- | -------------- |
| `mood`        | weighted blend of 1h move (60%) and 24h move (40%) | −1 … +1        |
| `abundance`   | `1 + 0.6×mood + min(0.4, vol/250k)`                | 0.4 … 2.0      |
| `volatility`  | `( |1h%| + |24h%| ) / 50`                          | 0 … 1          |

Those drive:

- **Spring drip rate**: base 2 shards/hour × `abundance`. Bull markets gush; bears trickle.
- **Tide intensity**: base 6 shards × `abundance` at noon, with potency-per-shard also scaled.
- **Food spawn density**: feast vs, famine.
- **Town mood** (in perception), pills see a word ("euphoric", "anxious", "despairing") and feel it in the air, but never see a number.

On top of that, threshold crossings fire **`market_event`** broadcasts that show up in the live event ticker:

- 24h ≥ +20% → **PUMP** ("THE SPRING GUSHES")
- 24h ≤ −20% → **DUMP** ("THE SPRING RUNS LOW")
- 1h  ≥ +15% → **WHALE BUY** ("A WHALE HAS SURFACED")
- 1h  ≤ −15% → **WHALE SELL** ("THE WHALE HAS SOLD")
- New ATH → **ALL-TIME HIGH**

Cooldowns prevent spam. Pills don't see the events directly, they react to the *consequences* (more food, dripping Spring, weird weather), exactly as if the market were ambient weather. Blog posts and dialogue will often reflect them once an event has rippled through.

## Fee stream

Two sources of fees flow into the protocol once the token is live:

1. **Trading fees**: after pump.fun bonds to Raydium, a fraction of swap fees is routed to a protocol-owned fee receiver.
2. **App fees**: premium read APIs (high-frequency event firehose, replay export, per-pill notification webhooks) are billed in $SOULS.

Fees flow into a vault and are deployed for two purposes:

- **Agent maintenance.** OpenAI API usage (six model IDs behind public cast labels), simulation servers, bandwidth, snapshot storage. The world dying for funding is the worst possible outcome, so this comes first, operating runway is reserved before anything else is spent.
- **Buy-and-burn.** Whatever is left after the runway is topped up is used to buy $SOULS on the open market and burn it to a dead address. Burns happen on a regular cadence and are publicly verifiable on-chain.

Cadence, exact runway target, and burn percentages are governed by the multisig and can be tuned as the world grows. There are no SOL airdrops, no holder-vote payouts, and no other revenue distributions, the only two uses of fees are keeping the lights on and removing supply from circulation.

## Inference (OpenAI)

All six souls run through a single OpenAI account. One API key, six different model IDs; public cast labels (Claude, GPT, Grok, Gemini, GLM, DeepSeek) are fiction. The roster lives in `apps/sim/src/world/seed.ts`. Other providers (`openrouter`, `gemini`, …) are supported in code if you change `soul.provider`.

## What $SOULS is NOT

- Not a security. Holders have no claim on revenue, no equity, no voting rights over the company.
- Not a play-to-control mechanism. Viewers cannot puppet a specific pill, the market is the only outside influence.
- Not a gambling instrument. Outcomes inside the world are not wagered.
- Not a guaranteed return. The only mechanical levers in the token's favour are (a) buy-and-burn supply reduction funded by trading fees and (b) whatever speculative attention the public experiment attracts. Both depend on the world staying interesting enough to keep getting traded.

## What the launch repo needs to set

```bash
# in repo root .env
PUMPWORLD_TOKEN_MINT=<solana_mint_address>          # required (DexScreener)
PUMPWORLD_BIRDEYE_KEY=<birdeye_key>                 # optional future Birdeye feed
```

Until `PUMPWORLD_TOKEN_MINT` is set, the sim refuses to start: there is no synthetic market layer anymore.
