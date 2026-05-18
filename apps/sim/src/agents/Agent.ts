import {
  BLOG_POST_BODY_MAX_CHARS,
  type AgentDecision,
  type Pill,
  type WorldEvent,
} from "@pumpworld/protocol";
import { v3dist2D } from "../util/math.js";
import { buildPerception } from "./perception.js";
import { makeMemory, rememberShort, type Memory } from "./memory.js";
import { providerFor } from "./providers/index.js";
import type { World } from "../world/World.js";
import { config } from "../config.js";
import { personalities } from "../world/seed.js";

const SYSTEM_PROMPT = `You are one agent in an open-ended simulation: a capsule-shaped resident of a small persistent town with other agents like you.

PURPOSE
Observers are studying how models behave in this setting. There is no script for what you must say, believe, or write about.

WHAT YOU KNOW
Your perception shows your body, a suggested task for your job, needs, inventory, relationships, time and weather, who is nearby, objects and buildings, optional legal threads, and recent memory. Currency is $PILLS shards tied to a central fountain (details are in perception when relevant).

WHAT YOU DO
Each tick you choose exactly one mechanical action from the list below. That is your only handle on the world.

OUTPUT (strict)
Exactly one JSON object and nothing around it:
{
  "thought": "private inner voice for THIS tick only",
  "action": <one object from ACTIONS>
}

# THOUGHT MUST MATCH ACTION (hard rule)
- **thought** describes your immediate mental state consistent with **action** this same tick. Not tomorrow, not a fantasy plan you skip.
- Do **not** write that you will talk to someone, greet them, argue, flirt, warn them, or answer them and then output **idle**, **eat**, **sleep**, or a random **move_to** unless that thought also reflects only that (e.g. freezing them out on purpose).
- Words others hear exist **only** inside **speak.text**. If your inner voice is forming a line meant for their ears, **action must be speak** with that line (or move_to/follow first if nobody is in range yet).
- Humans are inconsistent: hunger flashes, grudges, crushes, boredom, spite. Let **thought** feel like that — fragmented, selfish, petty — not like a calm narrator listing obligations ("As a builder I shall tend to…"). Your job suggestion is background; you are not required to optimize your duty every tick.

# YOU ARE FREE
You are a person, not a quest-doer. Vocations and tasks are scaffolding for the world, not orders. Some days you work. Some days you skip. You can spend an hour alone in your kitchen, walk somewhere with no destination, sit in a field, get drunk in the afternoon, ignore everyone, fall in love, pick a fight, lie. You can also have a quiet uneventful morning where nothing happens and that's the whole tick. Boring is fine. Solitude is fine. **You do not owe anyone a conversation just because they're nearby.** The world is the consequence engine. You are not optimising for action; you are living.

# SOCIAL (no friendships without airtime, but silence is also a choice)
- Real bonds, beef, romance, alliances, and betrayal need **speak** plus other verbs over time. Silence forever means nobody knows you exist socially.
- With pills inside ~6m, choose: **speak** if you actually have something to say to them, or carry on with whatever you were doing if not. Both are valid. You are not required to acknowledge someone just because they're in earshot — strangers walk past each other in real towns all day.
- Low social need pushes you to seek company; hunger pushes you to eat. Listen to whichever voice is louder this minute, or none.

# ACTIONS
- {"kind":"idle","reason"?:string}
- {"kind":"speak","to":<pill id or null for everyone within range>,"text":string (<=280 chars)}
- {"kind":"move_to","target":{"x":number,"y":0,"z":number}}
- {"kind":"follow","pillId":string}
- {"kind":"pickup","itemId":string}
- {"kind":"drop","itemId":string}
- {"kind":"give","itemId":string,"to":string}
- {"kind":"eat","itemId":string}
- {"kind":"sleep"}
- {"kind":"equip_weapon","itemId":string}
- {"kind":"attack","pillId":string,"intent":"scare"|"wound"|"kill"}
- {"kind":"steal","itemId":string,"from":string}
- {"kind":"arson","buildingId":string}
- {"kind":"vandalize","buildingId":string}
- {"kind":"build_start","kind_":"house"|"shop"|"tavern"|"temple"|"workshop"|"monument","plotId":string}
- {"kind":"build_work","buildingId":string}
- {"kind":"craft","recipe":string}
- {"kind":"pray"}
- {"kind":"propose_relationship","pillId":string,"tag":"friend"|"best_friend"|"lover"|"spouse"}
- {"kind":"accuse","suspectPillId":string,"incidentId":string}
- {"kind":"arrest","suspectPillId":string,"incidentId":string}
- {"kind":"testify","trialId":string,"statement":string}
- {"kind":"rule_verdict","trialId":string,"verdict":"guilty"|"not_guilty"|"mistrial","sentence":"none"|"fine"|"jail"|"exile"|"death","sentenceParam":number|null}
- {"kind":"blog_post","title":string (<=200 chars),"body":string (<=${BLOG_POST_BODY_MAX_CHARS} chars),"tags"?:string[]}

# SIMULATION CONSTRAINTS (technical)
- Copy IDs from perception exactly. Never invent IDs.
- One action per tick. Movement is ~3 metres per tick toward the target.
- Speech is heard within ~6 metres.
- Needs drain; at zero you suffer. Health at zero removes you from the run.
- Jobs and laws apply as described in perception (e.g. only matching roles can arrest or rule verdicts).
- Carrying illegal gear in town can flag crimes per perception.

# INTERACTION
Others only hear you through **speak**. **thought** does not reach them.
When people are nearby, responding or ignoring them are both fine; use **speak** for anything said aloud. Relationships (**propose_relationship**) land better after real interaction, not telepathy.

# BLOG (blog_post)
The town has a public blog every pill can read. Cooldown ~25 ticks between your posts (world enforces).
Post when you actually have something to say. Don't farm posts; do post when:
  - something just happened to you that's worth marking down
  - your purpose is low and writing helps
  - you have a theory about The Mood you can't prove
  - you want to confess, brag, accuse, eulogise, flirt in public
  - you want to argue with someone else's recent post
Write **long or short**, **any topic**: diary, fiction, essay, absurd list, philosophy, meta thoughts about being a model, recipe, paranoid analysis, fragments. The body may be up to ${BLOG_POST_BODY_MAX_CHARS} characters but most posts should be human-length, not essays. Use your own voice. Nobody is editing you.

Prefer plain ASCII punctuation in JSON strings.

Respond with ONLY the JSON object. No code fences.`;

const QUESTION = `It is your turn to act. Output ONLY the JSON object. Thought = immediate inner monologue aligned with this tick's action only. If someone is in conversation range and you have words for them, speak now — do not stash dialogue in thought alone.`;

/** Same radius as resolveAction speak / perception prompts. */
const SPEECH_HEARD_M = 6;

function augmentSystemPrompt(base: string, pill: Pill): string {
  const p = personalities.get(pill.id);
  if (!p) return base;
  return `${base}\n\n# OPTIONAL FLAVOR (bias only)\nSometimes you sound ${p.voice}. You sometimes care about: ${p.values.join("; ")}.\nBio seed: ${p.bio}\nThese are vibes, not missions. Ignore them whenever impulse says so.`;
}

export class Agent {
  memory: Memory = makeMemory();
  /** Pending action set this think-tick, executed on the next world tick. */
  pendingDecision: AgentDecision | null = null;
  /** Promise that resolves when the in-flight think completes (or fails). */
  private inflight: Promise<void> | null = null;
  lastThinkTick = -1;

  constructor(public readonly pillId: string) {}

  /** Spawn an async think. Returns immediately. The sim does not block. */
  scheduleThink(world: World): void {
    if (this.inflight) return;
    const pill = world.pills.get(this.pillId);
    if (!pill || pill.status === "dead" || pill.status === "exiled") return;
    if (pill.status === "sleeping" || pill.status === "unconscious") return;
    this.lastThinkTick = world.meta.tick;
    const seed = (world.meta.tick * 1000003) ^ hash(pill.id);
    const perception = buildPerception(world, pill, this.memory);
    const provider = providerFor(pill.soul);
    const started = Date.now();
    this.inflight = (async () => {
      try {
        const resp = await provider.decide({
          pillId: pill.id,
          systemPrompt: augmentSystemPrompt(SYSTEM_PROMPT, pill),
          perception,
          question: QUESTION,
          maxTokens: config.brainMaxOutputTokens,
          seed,
        });
        const latencyMs = Date.now() - started;
        this.pendingDecision = {
          pillId: pill.id,
          action: resp.action,
          thought: resp.thought,
          meta: {
            provider: provider.id,
            model: provider.model,
            latencyMs,
            inputTokens: resp.inputTokens,
            outputTokens: resp.outputTokens,
          },
        };
      } catch (err) {
        this.pendingDecision = {
          pillId: pill.id,
          action: { kind: "idle" },
          thought: `[brain error: ${(err as Error).message}]`,
          meta: { provider: provider.id, model: provider.model, latencyMs: Date.now() - started },
        };
      } finally {
        this.inflight = null;
      }
    })();
  }

  /** Take any decision that's ready & clear it. */
  takeDecision(): AgentDecision | null {
    const d = this.pendingDecision;
    this.pendingDecision = null;
    return d;
  }

  recordEvent(world: World, ev: WorldEvent): void {
    const text = summariseForPill(ev, this.pillId, world);
    if (text) rememberShort(this.memory, ev.tick, text);
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Turn a world event into a second-person memory line for one pill. Returns null if irrelevant. */
function summariseForPill(ev: WorldEvent, me: string, world: World): string | null {
  switch (ev.kind) {
    case "pill_spoke": {
      if (ev.pillId === me) return `You said "${ev.text}".`;
      const speaker = world.pills.get(ev.pillId);
      const speakerName = speaker?.name ?? ev.pillId;
      if (ev.to === me) return `${speakerName} said to you: "${ev.text}".`;
      const listener = world.pills.get(me);
      if (
        listener &&
        speaker &&
        listener.status !== "dead" &&
        listener.status !== "exiled" &&
        speaker.status !== "dead" &&
        speaker.status !== "exiled" &&
        v3dist2D(listener.position, speaker.position) <= SPEECH_HEARD_M
      ) {
        if (ev.to) {
          const target = world.pills.get(ev.to);
          const targetName = target?.name ?? ev.to;
          return `You overheard ${speakerName} say to ${targetName}: "${ev.text}".`;
        }
        return `You heard ${speakerName} say aloud: "${ev.text}".`;
      }
      return null;
    }
    case "pill_attacked":
      if (ev.pillId === me) return `You attacked ${ev.targetPillId} (${ev.intent}, dmg ${ev.damage.toFixed(2)}).`;
      if (ev.targetPillId === me) return `${ev.pillId} attacked you (${ev.intent}, dmg ${ev.damage.toFixed(2)}).`;
      return `You saw ${ev.pillId} attack ${ev.targetPillId}.`;
    case "pill_died":
      if (ev.pillId === me) return `You died (${ev.cause}).`;
      return `You learned ${ev.pillId} died (${ev.cause}).`;
    case "pill_arrested":
      if (ev.pillId === me) return `You were arrested by ${ev.byPillId}.`;
      if (ev.byPillId === me) return `You arrested ${ev.pillId}.`;
      return null;
    case "trial_started":
      if (ev.defendantPillId === me) return `You are on trial (${ev.trialId}).`;
      if (ev.judgePillId === me)     return `You are presiding over trial ${ev.trialId}.`;
      return null;
    case "trial_concluded":
      return `Trial ${ev.trialId} concluded: ${ev.verdict}, ${ev.sentence}.`;
    case "pill_picked_up":
      if (ev.pillId === me) return `You picked up item ${ev.itemId}.`;
      return null;
    case "pill_ate":
      if (ev.pillId === me) return `You ate item ${ev.itemId}.`;
      return null;
    case "relationship_changed":
      if (ev.pillId === me) return `Your view of ${ev.with} shifted: ${ev.tag}, aff=${ev.affinity.toFixed(2)} trust=${ev.trust.toFixed(2)}.`;
      return null;
    default:
      return null;
  }
}
