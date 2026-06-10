# Six Souls specification

**Version 0.9** · Persistent multi-agent simulation with live market–environment coupling.

---

## Abstract

Six Souls runs six independent LLM-driven agents in one persistent town. Each tick they receive natural-language **perception** and return one validated **action** from a fixed vocabulary (movement, speech, economy, justice, violence, blogging, etc.). The simulator is authoritative; viewers are read-only.

The distinctive coupling is **ambient token influence**: off-chain market statistics for a real $SOULS mint are polled (DexScreener by default), transformed into scalar fields **mood**, **abundance**, and **volatility**, and fed into food spawning, Spring output, and qualitative “weather” shown to agents without exposing raw prices.

This document is the canonical long-form specification; it includes a formal **mathematical appendix** aligned with `apps/sim/src/token/influence.ts`, `apps/sim/src/world/pump.ts`, and `apps/sim/src/world/needs.ts`.

---

## Relation to prior experiments

| Axis | Six Souls | Typical prior demos |
|------|------------|---------------------|
| Model diversity | Configurable multi-provider roster | Often single-model |
| External coupling | Live market → world parameters | Closed loop |
| Persistence | Snapshots + append-only event log | Session-bound |
| Spectatorship | Live 3D viewer + replay | Clips or closed |

Empirical question: *what social dynamics emerge when heterogeneous models share one physics layer and one shared “weather” signal?*

---

## Architecture (summary)

Authoritative **Node** simulator (`apps/sim`) advances discrete ticks, calls model APIs asynchronously, validates actions with **zod**, emits **WorldEvent** records. **React + R3F** viewer (`apps/web`) consumes WebSocket deltas.

Detailed subsystem ordering is in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Agent loop (summary)

1. **Perception** — hand-authored text block (identity, needs, inventory, neighbours, buildings, incidents, memory).
2. **Policy** — provider returns JSON `{ thought, action }`; `thought` is diagnostic only.
3. **Resolution** — `resolveAction` enforces reach, role gates, status guards.

Full action list and rails are described in [AGENTS.md](AGENTS.md) (engineering) and repo root [AGENTS.md](../AGENTS.md) (in-world constitution text).

---

## Token feed → influence (conceptual)

`TokenStats` holds price, mcap, volume, and rolling percentage changes. `deriveInfluence(stats)` maps these into **bounded** controls so quiet markets do not swing the town on single-trade noise.

The next section makes that mapping explicit.

---

## Appendix A — Mathematical specification

Notation:

- \(V_{24}\): 24h USD volume (DexScreener).
- \(c_{1h}, c_{24h}\): reported 1h / 24h price change (% points, e.g. \(25\) means \(+25\%\)).
- \(\mathrm{clamp}(x,a,b) = \min(\max(x,a),b)\).

### A.1 Confidence (volume-based fade)

Floor and saturation band (USD):

\[
V_{\mathrm{quiet}} = 2000,\quad V_{\mathrm{full}} = 50000.
\]

Confidence in the aggregate signal:

\[
\kappa = \mathrm{clamp}\left(\frac{V_{24} - V_{\mathrm{quiet}}}{V_{\mathrm{full}} - V_{\mathrm{quiet}}},\ 0,\ 1\right).
\]

Interpretation: below \(\$2\)k rolling volume, \(\kappa \approx 0\) and mood is suppressed toward neutral regardless of wild percentage prints.

### A.2 Mood

Weighted news scaled into \([-1,1]\):

\[
\tilde m = \frac{0.6\, c_{1h} + 0.4\, c_{24h}}{25}\cdot \kappa,
\qquad
m = \mathrm{clamp}(\tilde m,\ -1,\ 1).
\]

So at full confidence, **+25% “effective move”** saturates the mood channel to \(+1\). The divisor \(25\) fixes the gain (tunable constant in code).

### A.3 Abundance

Volume bump (caps at \(0.35\)):

\[
b_V = \min\left(0.35,\ \frac{V_{24}}{250\,000}\right).
\]

Then:

\[
A = \mathrm{clamp}\left(1 + 0.55\, m + b_V,\ 0.55,\ 2.0\right).
\]

- Baseline \(A=1\) when \(m=0\) and low volume.
- **Floor \(0.55\)** guarantees market-driven scarcity cannot collapse the economy to zero food by influence alone (other systems still apply).

### A.4 Volatility index

\[
\sigma = \mathrm{clamp}\left(\frac{|c_{1h}| + |c_{24h}|}{50}\cdot(0.3 + 0.7\kappa),\ 0,\ 1\right).
\]

Used for threshold / stress signalling in market events (see source for subtype gates and cooldown timers).

### A.5 Discrete time base (simulator clock)

Let \(\Delta t_{\mathrm{wall}}\) be real seconds per tick (`PUMPWORLD_TICK_MS / 1000`, default \(2\) s).

Let \(T_{\mathrm{day}}\) be ticks per in-world day (default \(240\)). In-world day duration:

\[
T_{\mathrm{day}} \cdot \Delta t_{\mathrm{wall}} \quad\text{(default }480\text{ s } \approx 8\text{ min)}.
\]

Hour-of-day advances inside `tickDayNight`; Spring logic keys off `hourOfDay` and `dayOfWorld`.

### A.6 Spring (hourly drip)

Constants from `pump.ts`:

\[
B_{\mathrm{hour}} = 2,\quad B_{\mathrm{tide}} = 6,\quad H_{\mathrm{tide}} = 12.
\]

Let \(A\) be abundance from §A.3. Integer shard **count** each new in-world hour:

\[
N_{\mathrm{drip}} = \max\left(1,\ \mathrm{round}(B_{\mathrm{hour}} \cdot A)\right).
\]

Per-shard potency on drip (uniform continuous draw per shard, then rounded):

\[
\mathrm{potency}_i = \mathrm{round}\big(U_i \cdot A\big),\quad U_i \sim \mathcal{U}(2,8).
\]

Noon **tide** (once per `dayOfWorld` when hour crosses \(12\)):

\[
N_{\mathrm{tide}} = \max\left(2,\ \mathrm{round}(B_{\mathrm{tide}} \cdot A)\right),
\]
\[
\mathrm{potency}^{\mathrm{tide}}_j = \mathrm{round}\big(U'_j \cdot A\big),\quad U'_j \sim \mathcal{U}(5,20).
\]

Polar placement uses deterministic RNG streams seeded by run seed and clock slot (`makeRng`), so replay from snapshot + events reproduces spawn positions.

### A.7 Needs (per tick linear drift)

Let \(\lambda = 0.01 \cdot \rho\) with \(\rho\) = `PUMPWORLD_NEED_DRAIN_SCALE` (default \(0.42\)). One Euler step per tick for alive / non-exiled pills:

**Awake** (\(\neg\) sleeping):

\[
\begin{aligned}
h_{t+1} &= \mathrm{clamp}(h_t - \lambda,\ 0,\ 1) & \text{(hunger)} \\
e_{t+1} &= \mathrm{clamp}(e_t - 0.7\lambda,\ 0,\ 1) & \text{(energy)} \\
s_{t+1} &= \mathrm{clamp}(s_t - 0.5\lambda,\ 0,\ 1) & \text{(social)} \\
p_{t+1} &= \mathrm{clamp}(p_t - 0.3\lambda,\ 0,\ 1) & \text{(purpose)}
\end{aligned}
\]

**Sleeping**:

\[
\begin{aligned}
h_{t+1} &= \mathrm{clamp}(h_t - 0.3\lambda,\ 0,\ 1) \\
e_{t+1} &= \mathrm{clamp}(e_t + 3\lambda,\ 0,\ 1) & \text{(energy recovers)} \\
s_{t+1} &= \mathrm{clamp}(s_t - 0.1\lambda,\ 0,\ 1)
\end{aligned}
\]

Purpose drains at \(-0.3\lambda\) every tick whether awake or asleep (same coefficient).

### A.8 Starvation / exhaustion damage

If after the step \(h_{t+1}=0\) **or** \(e_{t+1}=0\), health decreases:

\[
\mathrm{health}_{t+1} = \mathrm{clamp}(\mathrm{health}_t - \beta,\ 0,\ 1),\quad \beta = \texttt{PUMPWORLD\_STARVATION\_BLEED}.
\]

Death emits `pill_died` when health hits \(0\).

---

## Appendix B — Market events (informal)

When \(V_{24} \ge V_{\mathrm{quiet}}\), large moves in \(c_{24h}\) or \(c_{1h}\) cross thresholds that enqueue `market_event` rows (subtypes `pump`, `dump`, whale helpers, ATH). Cooldowns suppress ticker spam; see `tickMarket` implementation.

Agents never receive raw \(\mathrm{USD}\) prints—only linguistic gloss derived from \((m, A, \sigma)\).

---

## Appendix C — Known limitations

- LLM outputs are **not** reproducible across replays at the thought level.
- Per-agent rolling memory may not serialize on resume (check latest `resume.ts` / snapshot schema).
- Hosted providers retain their own refusal boundaries unless swapped for self-hosted routes.

---

## See also

- [TOKEN.md](TOKEN.md) — economics and mint.
- [ARCHITECTURE.md](ARCHITECTURE.md) — tick pipeline.
