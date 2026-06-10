import { join } from "node:path";
import { Agent } from "./agents/Agent.js";
import { config, SERVER_VERSION } from "./config.js";
import { EventLog, newRunDir } from "./persistence/eventLog.js";
import { writeSnapshot } from "./persistence/snapshot.js";
import { createHttpServer } from "./server/httpServer.js";
import { WsBroadcaster } from "./server/wsServer.js";
import { runTick } from "./world/tick.js";
import { seedWorld, syncPersonalitiesWithWorld, migrateSoulsFromRoster } from "./world/seed.js";
import type { TokenFeed } from "./token/TokenFeed.js";
import { DexScreenerFeed } from "./token/DexScreenerFeed.js";
import { OffTokenFeed } from "./token/OffTokenFeed.js";
import { newMarketState } from "./token/influence.js";
import { resumeOrSeed } from "./persistence/resume.js";
import { ensureBrainsConfigured } from "./agents/providers/index.js";

function createTokenFeed(): TokenFeed {
  const legacyMock = (process.env.PUMPWORLD_TOKEN_FEED ?? "").toLowerCase() === "mock";
  if (legacyMock) {
    throw new Error(
      "PUMPWORLD_TOKEN_FEED=mock was removed. Set PUMPWORLD_TOKEN_MINT and use DexScreener (no API key).",
    );
  }
  const mint = config.token.mintAddress.trim();
  if (!mint) {
    const deployRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
    if (deployRailway || process.env.PUMPWORLD_TOKEN_OFF === "1") {
      console.warn(
        "[sim] PUMPWORLD_TOKEN_MINT unset — using neutral token feed (no DexScreener). Set PUMPWORLD_TOKEN_MINT for live market stats.",
      );
      return new OffTokenFeed();
    }
    throw new Error(
      "PUMPWORLD_TOKEN_MINT is required. The sim polls DexScreener for live $SOULS price and volume.",
    );
  }
  if (config.token.source !== "auto" && config.token.source !== "dexscreener") {
    throw new Error(`Unsupported PUMPWORLD_TOKEN_FEED value: ${config.token.source}`);
  }
  return new DexScreenerFeed(mint, config.token.pollMs);
}

async function main() {
  // Attempt to resume the latest snapshot for this seed (so server restarts
  // don't reset the town). Force a fresh start with PUMPWORLD_FRESH_START=1.
  const seedFnInternal = () => seedWorld();
  const resume = resumeOrSeed(config.dataDir, config.seed, config.forceFreshStart, seedFnInternal);
  const world = resume.world;
  // Align side-channel personalities with pill ids (critical after snapshot resume).
  syncPersonalitiesWithWorld(world);
  // Re-bind each pill's soul (provider/model) to the current ROSTER. This
  // makes roster swaps apply on the next deploy without forcing a fresh
  // start: the pills keep their names, homes, memories, relationships,
  // and only the brain-routing changes. Idempotent on fresh genesis.
  migrateSoulsFromRoster(world);
  const runDir = resume.runDir ?? newRunDir(config.dataDir, world.meta.seed);
  const log = new EventLog(join(runDir, "events.jsonl"));
  // Only emit genesis events if this is a fresh start.
  if (resume.source === "genesis") {
    log.append(world.drainEvents()); // genesis + spawns
  } else {
    world.drainEvents(); // discard spurious events queued during hydrate (none expected)
  }

  const agents = new Map<string, Agent>();
  for (const pill of world.pills.values()) agents.set(pill.id, new Agent(pill.id));

  // Fail before binding PORT so deploy logs show a brain-config error instead of only Railway "503 /healthz".
  ensureBrainsConfigured(world);

  const tokenFeed: TokenFeed = createTokenFeed();
  console.log(
    tokenFeed.id === "dexscreener"
      ? `  token feed: DexScreener (${config.token.mintAddress.trim()})`
      : `  token feed: ${tokenFeed.id} (neutral / no live mint)`,
  );
  tokenFeed.start();
  const marketState = newMarketState();

  const unifiedPort = config.httpPort === config.wsPort;
  const httpServer = createHttpServer(world);
  const ws = unifiedPort
    ? new WsBroadcaster({ server: httpServer, onError: err => console.error("[ws]", err) })
    : new WsBroadcaster({ port: config.wsPort, onError: err => console.error("[ws]", err) });
  ws.setSnapshotProvider(() => world.snapshot());
  ws.setSnapshot(world.snapshot());
  if (process.env.HOST != null) {
    httpServer.listen(config.httpPort, process.env.HOST);
  } else if (process.env.PORT != null) {
    httpServer.listen(config.httpPort, "0.0.0.0");
  } else {
    httpServer.listen(config.httpPort);
  }

  // Write the genesis snapshot up-front so replays of even very short runs
  // have a starting point to load.
  await writeSnapshot(runDir, world.snapshot());

  console.log(`\n  SIX SOULS v${SERVER_VERSION}`);
  console.log(`  source:      ${resume.source === "snapshot" ? `resumed from tick ${resume.resumedFromTick}` : "fresh genesis"}`);
  console.log(`  seed:        ${world.meta.seed}`);
  console.log(`  tickMs:      ${world.meta.tickMs}`);
  if (unifiedPort) {
    console.log(`  listen:      HTTP + WebSocket on port ${config.httpPort} (single port)`);
  } else {
    console.log(`  http:        http://localhost:${config.httpPort}`);
    console.log(`  websocket:   ws://localhost:${config.wsPort}`);
  }
  console.log(`  data dir:    ${runDir}`);
  console.log(`  pills:       ${world.pills.size}`);
  console.log("");

  let lastWallMs = Date.now();
  let tpsAvg = 0;
  let lastSnapshotTick = resume.resumedFromTick;

  const interval = setInterval(() => {
    const t0 = Date.now();
    let events: ReturnType<typeof runTick> = [];
    try {
      events = runTick(world, {
        agents,
        onBrain: (pillId, thought, intent) => ws.broadcastBrain(pillId, thought, intent),
        tokenFeed,
        marketState,
      });
    } catch (err) {
      // A tick must never kill the process. Log loudly and skip downstream work
      // for this beat — the next tick will pick up where the world is now.
      console.error(`[sim] tick ${world.meta.tick} threw:`, err);
      return;
    }
    try {
      log.append(events);
      ws.broadcastEvents(events);
    } catch (err) {
      console.error("[sim] post-tick io failed:", err);
    }

    const aliveCount = world.alivePills().length;
    const queueDepth = [...agents.values()].filter(a => !!(a as unknown as { pendingDecision: unknown }).pendingDecision).length;
    const now = Date.now();
    const dt = now - lastWallMs;
    lastWallMs = now;
    const instTps = dt > 0 ? 1000 / dt : 0;
    tpsAvg = tpsAvg === 0 ? instTps : tpsAvg * 0.9 + instTps * 0.1;
    try {
      ws.broadcastMetrics(tpsAvg, aliveCount, queueDepth, world.meta.tick);
      // Send the live meta (incl. token stats + influence) every tick. Tiny payload.
      ws.broadcastMeta(world.meta);
    } catch (err) {
      console.error("[sim] broadcast failed:", err);
    }

    if (world.meta.tick - lastSnapshotTick >= 60) {
      lastSnapshotTick = world.meta.tick;
      const snap = world.snapshot();
      ws.setSnapshot(snap);
      writeSnapshot(runDir, snap).catch(err => console.error("[snap]", err));
    }
    const elapsed = Date.now() - t0;
    if (elapsed > world.meta.tickMs) {
      console.warn(`[sim] tick ${world.meta.tick} overran budget: ${elapsed}ms > ${world.meta.tickMs}ms`);
    }
  }, world.meta.tickMs);

  const shutdown = async () => {
    clearInterval(interval);
    tokenFeed.stop();
    console.log("\n[sim] shutting down, flushing log and snapshot...");
    const snap = world.snapshot();
    await writeSnapshot(runDir, snap);
    await log.close();
    await ws.close();
    await new Promise<void>(res => httpServer.close(() => res()));
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
