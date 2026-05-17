import type { WorldEvent } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";

/** Events we hide from the public ticker. */
const NOISE = new Set<WorldEvent["kind"]>([
  "tick", "pill_moved", "pill_thought",
  "item_spawned", "item_despawned", "item_moved",
  "relationship_changed", "building_progress",
  "pill_picked_up", "task_changed", "weather_changed", "new_day",
]);

type Tone = "speech" | "good" | "bad" | "warn" | "money" | "info" | "market_up" | "market_down" | "market_alert";

interface Line { text: string; tone: Tone; icon: string }

function describe(ev: WorldEvent, nameOf: (id: string) => string): Line | null {
  switch (ev.kind) {
    case "world_started":     return { icon: "✦", text: `World began`, tone: "info" };
    case "pill_spawned":      return { icon: "✺", text: `${ev.name} spawned`, tone: "good" };
    case "pill_spoke": {
      const toPart = ev.to ? ` → ${nameOf(ev.to)}` : "";
      return { icon: "”", text: `${nameOf(ev.pillId)}${toPart}: ${ev.text}`, tone: "speech" };
    }
    case "pill_died":         return { icon: "✕", text: `${nameOf(ev.pillId)} died (${ev.cause})`, tone: "bad" };
    case "pill_attacked":     return { icon: "⚔", text: `${nameOf(ev.pillId)} → ${nameOf(ev.targetPillId)} (${ev.intent})`, tone: "warn" };
    case "pill_arrested":     return { icon: "⛓", text: `${nameOf(ev.pillId)} arrested`, tone: "warn" };
    case "pill_released":     return { icon: "🗝", text: `${nameOf(ev.pillId)} released`, tone: "good" };
    case "pill_exiled":       return { icon: "→", text: `${nameOf(ev.pillId)} exiled`, tone: "warn" };
    case "pill_ate":          return { icon: "♨", text: `${nameOf(ev.pillId)} ate`, tone: "info" };
    case "pill_gave":         return { icon: "↦", text: `${nameOf(ev.pillId)} gave to ${nameOf(ev.to)}`, tone: "good" };
    case "pill_equipped":     return { icon: "⚒", text: `${nameOf(ev.pillId)} equipped a weapon`, tone: "warn" };
    case "pill_slept":        return { icon: "z", text: `${nameOf(ev.pillId)} slept`, tone: "info" };
    case "incident_logged":   return { icon: "!", text: `${ev.incidentKind}${ev.suspectPillId ? ` by ${nameOf(ev.suspectPillId)}` : ""}`, tone: "warn" };
    case "trial_started":     return { icon: "§", text: `trial of ${nameOf(ev.defendantPillId)} begins`, tone: "warn" };
    case "trial_statement":   return { icon: "”", text: `${nameOf(ev.pillId)} testified`, tone: "info" };
    case "trial_concluded":   return { icon: "§", text: `${ev.verdict} · ${ev.sentence}`, tone: ev.verdict === "guilty" ? "bad" : "good" };
    case "building_started":  return { icon: "⌂", text: `${nameOf(ev.ownerPillId)} began building`, tone: "good" };
    case "building_completed":return { icon: "⌂", text: `a building was completed`, tone: "good" };
    case "building_burning":  return { icon: "🔥", text: `a building is on fire`, tone: "bad" };
    case "building_destroyed":return { icon: "✕", text: `a building collapsed`, tone: "bad" };
    case "pump_dripped":      return { icon: "✦", text: `Spring dripped +${ev.amount} $PILLS`, tone: "money" };
    case "pump_tide":         return { icon: "✺", text: `TIDE: ${ev.amount} $PILLS poured`, tone: "money" };
    case "pill_executed":     return { icon: "☠", text: `${nameOf(ev.pillId)} executed`, tone: "bad" };
    case "blog_published":    return { icon: "✎", text: `${nameOf(ev.authorPillId)} published "${ev.title.slice(0, 40)}"`, tone: "info" };
    case "market_event": {
      const iconMap: Record<string, string> = {
        pump: "▲", dump: "▼", whale_buy: "🐋", whale_sell: "🐋", ath: "★", atl: "✕",
      };
      const tone: Tone =
        ev.subtype === "pump" || ev.subtype === "ath" || ev.subtype === "whale_buy"
          ? "market_up"
          : ev.subtype === "dump" || ev.subtype === "atl" || ev.subtype === "whale_sell"
          ? "market_down"
          : "market_alert";
      return { icon: iconMap[ev.subtype] ?? "◆", text: ev.message, tone };
    }
    default: return null;
  }
}

const TONE_FG: Record<Tone, string> = {
  info:        "var(--pw-text)",
  good:        "var(--pw-good)",
  bad:         "var(--pw-bad)",
  warn:        "var(--pw-warn)",
  money:       "var(--pw-gold)",
  speech:      "#cdd9ea",
  market_up:   "#9af075",
  market_down: "#ff7575",
  market_alert:"#ffd23f",
};
const TONE_BG: Record<Tone, string> = {
  info:        "transparent",
  good:        "rgba(124,212,162,0.06)",
  bad:         "rgba(244,114,114,0.08)",
  warn:        "rgba(240,198,116,0.06)",
  money:       "rgba(255,210,63,0.07)",
  speech:      "rgba(205,217,234,0.04)",
  market_up:   "rgba(154,240,117,0.12)",
  market_down: "rgba(255,117,117,0.14)",
  market_alert:"rgba(255,210,63,0.16)",
};

export function EventTicker() {
  const events = useWorld(s => s.recentEvents);
  const pills = useWorld(s => s.pills);
  const nameOf = (id: string) => pills.get(id)?.name ?? id.slice(0, 4);

  const filtered = events.filter(e => !NOISE.has(e.kind));

  return (
    <div style={{
      padding: "4px 6px",
      fontSize: 11,
      lineHeight: 1.35,
      overflowY: "auto",
      flex: 1,
    }}>
      {filtered.length === 0 && (
        <div style={{ color: "var(--pw-text-faint)", padding: "10px 6px" }}>Waiting for the world to wake up…</div>
      )}
      {filtered.map(ev => {
        const d = describe(ev, nameOf);
        if (!d) return null;
        const isSpeech = d.tone === "speech";
        return (
          <div key={ev.id} style={{
            display: "grid",
            gridTemplateColumns: "26px 14px 1fr",
            gap: 4,
            padding: "4px 6px",
            alignItems: isSpeech ? "start" : "baseline",
            background: TONE_BG[d.tone],
            borderRadius: 4,
            marginBottom: 1,
          }}>
            <span className="pw-mono" style={{ color: "var(--pw-text-faint)", fontSize: 9 }}>
              t{ev.tick}
            </span>
            <span style={{ color: TONE_FG[d.tone], textAlign: "center", fontSize: 11, paddingTop: isSpeech ? 2 : 0 }}>{d.icon}</span>
            <span style={{
              color: TONE_FG[d.tone],
              overflow: isSpeech ? "visible" : "hidden",
              textOverflow: isSpeech ? "clip" : "ellipsis",
              whiteSpace: isSpeech ? "normal" : "nowrap",
              wordBreak: isSpeech ? "break-word" : undefined,
              fontSize: 11,
              lineHeight: isSpeech ? 1.4 : 1.35,
            }}>
              {d.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
