import { useEffect, useState } from "react";
import { useWorld } from "../store/worldStore.js";
import { PillAvatar } from "./PillAvatar.js";

interface Line {
  id: number;
  pillId: string;
  text: string;
  to: string | null;
  bornMs: number;
}

const MAX_VISIBLE = 5;
const FADE_MS = 14000;

/**
 * Cinematic dialogue strip pinned to the bottom-centre. Listens for new
 * `pill_spoke` events from the live event stream and shows them stacked,
 * newest at the bottom, oldest fading out after FADE_MS.
 */
export function DialogueStrip() {
  const events = useWorld(s => s.recentEvents);
  const pills = useWorld(s => s.pills);
  const selectPill = useWorld(s => s.selectPill);
  const setCamera = useWorld(s => s.setCamera);

  const [lines, setLines] = useState<Line[]>([]);

  // Pump in new pill_spoke events as they arrive.
  useEffect(() => {
    const speechEvs = events
      .filter(e => e.kind === "pill_spoke")
      .slice(0, MAX_VISIBLE * 3); // search a bit further back
    setLines(prev => {
      const knownIds = new Set(prev.map(l => l.id));
      const additions: Line[] = [];
      const now = Date.now();
      // Iterate oldest → newest so we get insertion order right.
      for (let i = speechEvs.length - 1; i >= 0; i--) {
        const ev = speechEvs[i]!;
        if (knownIds.has(ev.id)) continue;
        if (ev.kind !== "pill_spoke") continue;
        additions.push({ id: ev.id, pillId: ev.pillId, text: ev.text, to: ev.to, bornMs: now });
      }
      const merged = [...prev, ...additions];
      return merged.slice(-MAX_VISIBLE);
    });
  }, [events]);

  // Periodically drop expired lines.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setLines(prev => {
        const filtered = prev.filter(l => now - l.bornMs < FADE_MS);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  if (lines.length === 0) return null;

  return (
    <div style={{
      position: "absolute",
      left: 332, right: 332, bottom: 84,
      display: "flex", flexDirection: "column", gap: 6,
      alignItems: "center",
      pointerEvents: "none",
    }}>
      {lines.map(line => {
        const pill = pills.get(line.pillId);
        if (!pill) return null;
        const age = Date.now() - line.bornMs;
        const fade = Math.max(0, 1 - Math.max(0, age - (FADE_MS - 2500)) / 2500);
        const target = line.to ? pills.get(line.to) : null;
        return (
          <button
            key={line.id}
            onClick={() => { selectPill(pill.id); setCamera("follow", pill.id); }}
            style={{
              pointerEvents: "auto",
              maxWidth: 680,
              minWidth: 360,
              padding: "12px 16px",
              background: "var(--pw-card)",
              border: `1px solid ${pill.shell.topColor}44`,
              borderLeft: `3px solid ${pill.shell.topColor}`,
              borderRadius: "var(--pw-radius-md)",
              color: "var(--pw-text)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: "var(--pw-shadow-md)",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.45,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 14,
              alignItems: "center",
              opacity: fade,
              transition: "opacity 220ms ease",
            }}
          >
            <PillAvatar pill={pill} size={34} withFace />
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{pill.name}</span>
                <span style={{ color: "var(--pw-text-faint)", fontSize: 11 }}>{pill.soul.label}</span>
                {target && (
                  <span style={{ color: "var(--pw-text-faint)", fontSize: 11 }}>
                    → {target.name}
                  </span>
                )}
              </div>
              <div style={{ marginTop: 4, color: "var(--pw-text)", fontSize: 14 }}>"{line.text}"</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
