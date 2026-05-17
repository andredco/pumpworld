# Roadmap

The v0.1 skeleton (in this repo) has the **whole loop alive end-to-end**: simulation server, AI brain layer, WebSocket streaming, 3D viewer, replay log. It is intentionally honest about what's a stub. This document is the contract for what comes next.

## v0.2. "It feels real" (1-2 weeks)

- [ ] **Construction physics**: real material costs (`materials` consumed from inventory), multi-tick build progress visible as a frame growing out of the ground, then walls then roof.
- [ ] **Day/night cycle**: sun arc, ambient temperature, NPC needs scale with time of day.
- [ ] **Voice line bubbles**: in-world speech bubbles fade after a few seconds; we already have `pill_spoke` events.
- [ ] **Pathfinding**: simple A* / steering around buildings rather than direct line-walks.
- [ ] **Item pickup UX**: pickup is currently a single tick; show a tiny grab animation.
- [ ] **Replay viewer** at `apps/replay/`: load `data/<run>/`, scrub a timeline, replay events at any speed.

## v0.3. "Society" (2-4 weeks)

- [ ] **Romance, family, lineage**: `propose_relationship` → mutual acceptance → `spouse` tag → birth event creates a new pill that inherits a blended persona. Lineage tree in inspector.
- [ ] **Economy**: a `coin` item is the unit of trade. `shop` buildings expose `buy` / `sell` actions. Wealth becomes meaningful.
- [ ] **Full trial flow**: judges actually run them, call witnesses (`testify`), weigh statements, deliver `rule_verdict`. Today this is wired but not yet driven end-to-end by the prompt.
- [ ] **Weapons & combat resolution**: facing/dodge rolls, ranged weapons (`shortbow` has range), bleed-out timers, medic pills can `heal`.
- [ ] **Reputation broadcast**: when a pill's notoriety crosses thresholds, all witnesses get a "rumour" memory.
- [ ] **Persistent identity per soul**: when a pill of soul X dies, the next spawn of soul X may inherit a memory blurb ("I remember a previous life as Pluto, who died in the fire"), if the spirituality trait is high enough.

## v0.4. "World doesn't end" (continuous)

- [ ] **Hot-resume**: load latest snapshot + tail of events on restart, world picks up where it stopped.
- [ ] **Postgres** persistence (drop the JSONL / on-disk snapshots into a real DB) so a single world can run for months.
- [ ] **Multi-shard**: run the world across multiple node processes (one shard per region), with cross-shard travel via portals.
- [ ] **Public landing page** at `apps/landing/`: livestream viewer (no controls), pill leaderboard, longest-lived pill, biggest crime spree, etc.

## v0.5. Token

See `docs/TOKEN.md` for the full design.

- [ ] Deploy SPL token + fee-collecting vault on Solana.
- [ ] On-chain registry of holders (or read-time fetch from a Solana indexer).
- [ ] Holder-funded **divine intervention** mechanic: holders vote (off-chain) on a small set of "miracles" the simulator can perform (weather change, NPC spawn, item rain). This is the only allowed interaction.
- [ ] Buyback-and-burn loop running from the fee vault.

## Out of scope (deliberately)

- "Truly jailbroken" frontier models. See `docs/AI_PROVIDERS.md`.
- Letting viewers control or talk to pills directly. The integrity of the experiment depends on read-only viewing.
- Real money inside the world. The in-world `wealth` is just an integer the pills argue over.

## Engineering debt to pay before v0.2

- [ ] Unit tests for `resolveAction`, `tickNeeds`, `concludeTrial`.
- [ ] Bound `EventLog` file size / rotate per N MB.
- [ ] Backpressure the WebSocket broadcaster (drop low-priority events if client is slow).
- [ ] Building state currently relies on snapshots for client sync, wire up granular `building_*` events into `worldStore.applyEvents`.
- [ ] Tighten provider error handling: detect rate-limit responses and circuit-break for a few ticks.
