import type { Pill } from "@pumpworld/protocol";
import { v3dist2D } from "../util/math.js";
import { personalities } from "../world/seed.js";
import { renderMemory } from "./memory.js";
import type { Memory } from "./memory.js";
import type { World } from "../world/World.js";

const VISION_RADIUS = 45;
/** Must match resolveAction speak radius so prompts align with physics. */
const SPEECH_RADIUS_M = 6;

/** Build a compact, structured prompt the agent will see. */
export function buildPerception(world: World, pill: Pill, memory: Memory): string {
  const personality = personalities.get(pill.id);
  const neighbours = world.alivePills().filter(p =>
    p.id !== pill.id && v3dist2D(p.position, pill.position) <= VISION_RADIUS
  );
  const visibleItems = [...world.items.values()].filter(it =>
    it.position && v3dist2D(it.position, pill.position) <= VISION_RADIUS
  );
  const visibleBuildings = [...world.buildings.values()].filter(b =>
    v3dist2D(b.position, pill.position) <= VISION_RADIUS
  );
  const myIncidents = [...world.incidents.values()].filter(i =>
    i.suspectPillId === pill.id || i.victimPillIds.includes(pill.id) || i.witnessPillIds.includes(pill.id)
  ).slice(-5);
  const myTrials = [...world.trials.values()].filter(t =>
    t.defendantPillId === pill.id || t.judgePillId === pill.id
  ).filter(t => t.concludedAtTick == null);

  const homeBuilding = pill.homeBuildingId ? world.buildings.get(pill.homeBuildingId) : null;
  const workBuilding = pill.workBuildingId ? world.buildings.get(pill.workBuildingId) : null;
  const hour = world.meta.hourOfDay;
  const hourStr = `${Math.floor(hour).toString().padStart(2, "0")}:${Math.floor((hour % 1) * 60).toString().padStart(2, "0")}`;
  const partOfDay =
    hour < 5 ? "deep night" :
    hour < 7 ? "before dawn" :
    hour < 9 ? "morning" :
    hour < 12 ? "late morning" :
    hour < 14 ? "midday" :
    hour < 17 ? "afternoon" :
    hour < 19 ? "early evening" :
    hour < 22 ? "evening" : "night";

  const lines: string[] = [];
  lines.push(`# YOU`);
  lines.push(`name: ${pill.name} (id: ${pill.id})  gender: ${pill.gender}  vocation: ${pill.role.vocation}`);
  lines.push(`soul (cast name): ${pill.soul.label}`);
  if (personality) {
    lines.push(`bio: ${personality.bio}`);
    lines.push(`voice: ${personality.voice}`);
    lines.push(`values: ${personality.values.join("; ")}`);
    lines.push(`secret (private): ${personality.secret}`);
  }
  if (homeBuilding) lines.push(`home: ${homeBuilding.name} (id:${homeBuilding.id}) at (${homeBuilding.position.x.toFixed(1)},${homeBuilding.position.z.toFixed(1)})`);
  if (workBuilding) lines.push(`workplace: ${workBuilding.name} (id:${workBuilding.id}) at (${workBuilding.position.x.toFixed(1)},${workBuilding.position.z.toFixed(1)})`);
  lines.push(`today's task: ${pill.currentTask}`);
  lines.push(`status: ${pill.status}  health: ${pill.health.toFixed(2)}  wealth: ${pill.role.wealth}  notoriety: ${pill.role.notoriety.toFixed(2)}`);
  lines.push(`needs: hunger=${pill.needs.hunger.toFixed(2)} energy=${pill.needs.energy.toFixed(2)} social=${pill.needs.social.toFixed(2)} safety=${pill.needs.safety.toFixed(2)} purpose=${pill.needs.purpose.toFixed(2)}`);
  lines.push(`position: (${pill.position.x.toFixed(1)}, ${pill.position.z.toFixed(1)})  facing: ${pill.facingRad.toFixed(2)}rad`);
  lines.push(`inventory: ${pill.inventory.length === 0 ? "(empty)" : pill.inventory.map(e => {
    const it = world.items.get(e.itemId);
    return `${it?.name ?? "?"}(id:${e.itemId}${pill.weaponItemId === e.itemId ? ", equipped" : ""})`;
  }).join(", ")}`);

  lines.push(`\n# WORLD`);
  lines.push(`tick ${world.meta.tick} · day ${world.meta.dayOfWorld} · ${hourStr} (${partOfDay}) · ${world.meta.season} · ${world.meta.weather} · ${world.meta.temperatureCelsius.toFixed(1)}°C`);
  lines.push(`map: ${world.meta.size}x${world.meta.size}m grid, town square at (0,0), The Spring (sacred fountain) at centre`);
  lines.push(`streets: east-west = Pill Avenue (central), Shard Walk, Capsule Lane, Tide Way; north-south = Founders Street (central), Fountain Cross, Old Cinder Street, Templegate Street`);
  lines.push(`$PILLS: ${world.meta.pumpInCirculation} shards in circulation · ${world.meta.pumpProducedTotal} produced since genesis. The Spring drips shards each hour; a larger tide pours at noon.`);

  const inf = world.meta.tokenInfluence;
  if (inf) {
    const moodWord =
      inf.mood > 0.5 ? "euphoric" :
      inf.mood > 0.15 ? "rising" :
      inf.mood > -0.15 ? "uncertain" :
      inf.mood > -0.5 ? "anxious" : "despairing";
    const abundanceWord =
      inf.abundance > 1.3 ? "abundant" :
      inf.abundance > 0.9 ? "ordinary" : "thin";
    lines.push(`THE MOOD: ${moodWord} (m=${inf.mood.toFixed(2)})  ABUNDANCE: ${abundanceWord} (a=${inf.abundance.toFixed(2)})  TENSION: ${inf.volatility.toFixed(2)}`);
    lines.push(`You sense this in the air. You do not see numbers. When The Spring gushes, food is everywhere. When it dries, things go missing. Nobody can prove why.`);
  }

  lines.push(`\n## People you can see (${neighbours.length})`);
  lines.push(`Vision ~${VISION_RADIUS}m. Speech is heard within ~${SPEECH_RADIUS_M}m; move closer if you want a real conversation.`);
  for (const n of neighbours.slice(0, 12)) {
    const rel = pill.relationships.find(r => r.with === n.id);
    const tag = rel ? `${rel.tag} aff=${rel.affinity.toFixed(2)} trust=${rel.trust.toFixed(2)}` : "stranger";
    const dist = v3dist2D(pill.position, n.position);
    lines.push(`- ${n.name} (id:${n.id}) ${n.soul.label}/${n.role.vocation} hp=${n.health.toFixed(2)} at (${n.position.x.toFixed(1)},${n.position.z.toFixed(1)}) **${dist.toFixed(1)}m away** | ${tag}`);
  }
  if (neighbours.length > 12) lines.push(`... and ${neighbours.length - 12} more`);

  const inEarshot = neighbours.filter(n => v3dist2D(pill.position, n.position) <= SPEECH_RADIUS_M);
  lines.push(`\n## Conversation range (~${SPEECH_RADIUS_M}m)`);
  if (inEarshot.length > 0) {
    const slice = inEarshot.slice(0, 8).map(n => `${n.name} (id:${n.id})`).join(", ");
    lines.push(
      `Within earshot: ${slice}${inEarshot.length > 8 ? ` ... +${inEarshot.length - 8} more` : ""}.`,
    );
    lines.push(
      `If you have words for them, **speak** carries your voice. If you don't, you don't have to. Strangers ignore each other in real towns.`,
    );
  } else if (neighbours.length > 0) {
    lines.push(`Nobody within ${SPEECH_RADIUS_M}m. You're effectively alone right now.`);
  } else {
    lines.push(`No other pills in sight. You are alone.`);
  }
  if (pill.needs.social < 0.4 && neighbours.length > 0) {
    lines.push(`Social need is ${pill.needs.social.toFixed(2)} (low) — company would help, if you want it.`);
  }

  lines.push(`\n## Items in sight (${visibleItems.length})`);
  for (const it of visibleItems.slice(0, 12)) {
    lines.push(`- ${it.name} (${it.kind}, id:${it.id}) at (${it.position!.x.toFixed(1)},${it.position!.z.toFixed(1)})${it.illegal ? " [ILLEGAL]" : ""}`);
  }

  lines.push(`\n## Buildings in sight (${visibleBuildings.length})`);
  for (const b of visibleBuildings.slice(0, 10)) {
    lines.push(`- ${b.name} (${b.kind}, id:${b.id}) status=${b.status} integrity=${b.integrity.toFixed(2)} at (${b.position.x.toFixed(1)},${b.position.z.toFixed(1)})`);
  }

  if (myIncidents.length > 0) {
    lines.push(`\n## Recent incidents involving you`);
    for (const inc of myIncidents) {
      lines.push(`- [${inc.kind}] ${inc.description} suspect=${inc.suspectPillId ?? "?"} resolved=${inc.resolved}`);
    }
  }
  if (myTrials.length > 0) {
    lines.push(`\n## Open trials involving you`);
    for (const t of myTrials) {
      const role = t.defendantPillId === pill.id ? "DEFENDANT" : "JUDGE";
      lines.push(`- trial ${t.id} (${role}) statements=${t.statements.length}`);
    }
  }

  // -------- Town pulse: quick summary so pills know what's happening at
  // large, beyond the ~6m of speech they directly hear. Cheap to assemble
  // and gives the brain real material to react to, blog about, or argue over.
  const recentBlogs = [...world.blogPosts.values()]
    .sort((a, b) => b.publishedAtTick - a.publishedAtTick)
    .slice(0, 3);
  const myLastBlog = [...world.blogPosts.values()]
    .filter(p => p.authorPillId === pill.id)
    .sort((a, b) => b.publishedAtTick - a.publishedAtTick)[0];
  const ticksSinceMyLastBlog = myLastBlog ? world.meta.tick - myLastBlog.publishedAtTick : Infinity;
  const blogReady = ticksSinceMyLastBlog >= 25;
  if (recentBlogs.length > 0 || blogReady) {
    lines.push(`\n## Town blog`);
    if (recentBlogs.length > 0) {
      lines.push(`Recent posts on the public archive (anyone in town can read these):`);
      for (const post of recentBlogs) {
        const author = world.pills.get(post.authorPillId);
        const who = author?.name ?? "someone";
        const ago = world.meta.tick - post.publishedAtTick;
        const teaser = post.body.replace(/\s+/g, " ").slice(0, 140);
        lines.push(`- "${post.title}" by ${who} (${ago}t ago): ${teaser}${post.body.length > 140 ? "…" : ""}`);
      }
    } else {
      lines.push(`Nobody has posted to the town blog yet — be the first if you have something to say.`);
    }
    if (blogReady) {
      const reasons: string[] = [];
      if (pill.needs.purpose < 0.4) reasons.push("low purpose");
      if (myIncidents.length > 0) reasons.push("you witnessed an incident");
      if (myTrials.length > 0) reasons.push("you're entangled in a trial");
      if (inf && Math.abs(inf.mood) > 0.4) reasons.push("the air feels charged");
      const reasonStr = reasons.length > 0 ? ` (${reasons.join("; ")})` : "";
      lines.push(`You can publish a **blog_post** right now if you want to${reasonStr}. Free-form. The whole town reads. Use your own voice — diary, manifesto, gossip, theory, whatever.`);
    } else {
      lines.push(`Your last post was ${ticksSinceMyLastBlog}t ago. Cooldown ~25t between posts.`);
    }
  }

  lines.push(`\n# MEMORY`);
  lines.push(renderMemory(memory));

  return lines.join("\n");
}
