import { useWorld } from "../store/worldStore.js";

const SEASON_ICON: Record<string, string> = {
  spring: "✿", summer: "☀", autumn: "🍂", winter: "❄",
};
const WEATHER_ICON: Record<string, string> = {
  clear: "☼", cloudy: "☁", overcast: "▦", rain: "☂", fog: "≋",
};

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h % 1) * 60);
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

function partOfDay(h: number): string {
  if (h < 5) return "night";
  if (h < 7) return "dawn";
  if (h < 12) return "morning";
  if (h < 14) return "midday";
  if (h < 18) return "afternoon";
  if (h < 20) return "dusk";
  if (h < 22) return "evening";
  return "night";
}

/**
 * Compact world-clock strip. Lives at the bottom-centre above the dialogue
 * strip, so it doesn't fight the TokenPanel for left-side real estate.
 */
export function HUD() {
  const meta = useWorld(s => s.meta);
  const metrics = useWorld(s => s.metrics);
  const connected = useWorld(s => s.connected);
  const pills = useWorld(s => s.pills);
  const total = pills.size;
  const alive = [...pills.values()].filter(p => p.status !== "dead" && p.status !== "exiled").length;

  const hour = meta?.hourOfDay ?? 12;
  const season = meta?.season ?? "spring";
  const weather = meta?.weather ?? "clear";
  const temp = meta?.temperatureCelsius ?? 18;
  const day = meta?.dayOfWorld ?? 0;
  const isNight = hour >= 22 || hour < 6;
  const tempColor = temp < 5 ? "#7fd6ff" : temp > 22 ? "#ffb27c" : "var(--pw-text)";

  return (
    <div style={{
      position: "absolute",
      top: 16, left: "50%", transform: "translateX(calc(-50% + 0px))",
      // sits beside the centred TopNav: we offset by the navbar's right edge
      // so we end up just to the right of it. Computed via flex layout in the
      // wrapper below; here we just leave room.
      pointerEvents: "none",
      display: "flex", justifyContent: "center",
      paddingTop: 70, // sits BELOW the centred nav pill
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "8px 16px",
        background: "rgba(7,9,12,0.84)",
        border: "1px solid var(--pw-border)",
        borderRadius: 99,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        color: "var(--pw-text)",
        fontSize: 11,
        whiteSpace: "nowrap",
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}>
        <span style={{
          padding: "2px 8px", fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          borderRadius: 99,
          background: connected ? "rgba(124,212,162,0.16)" : "rgba(244,114,114,0.16)",
          color: connected ? "var(--pw-good)" : "var(--pw-bad)",
        }}>
          {connected ? "● LIVE" : "OFFLINE"}
        </span>

        <Sep />
        <span style={{ color: "var(--pw-text-faint)", letterSpacing: 1, textTransform: "uppercase" }}>
          Day {day + 1} · {SEASON_ICON[season]}
        </span>
        <span className="pw-mono" style={{ color: isNight ? "#9ab" : "var(--pw-text)", fontWeight: 700, fontSize: 13 }}>
          {fmtHour(hour)}
        </span>
        <span style={{ color: "var(--pw-text-dim)" }}>{partOfDay(hour)}</span>

        <Sep />
        <span style={{ color: "var(--pw-text-dim)" }}>{WEATHER_ICON[weather]} {weather}</span>
        <span className="pw-mono" style={{ color: tempColor, fontWeight: 600 }}>{temp.toFixed(1)}°C</span>

        <Sep />
        <span className="pw-mono" style={{ color: "var(--pw-text-dim)" }}>tick {meta?.tick ?? 0}</span>
        <span className="pw-mono" style={{ color: "var(--pw-text)" }}>{alive}/{total}</span>
        <span className="pw-mono" style={{ color: "var(--pw-text-faint)" }}>{metrics.tps.toFixed(2)}t/s</span>
      </div>
    </div>
  );
}

function Sep() {
  return <span style={{ width: 1, height: 14, background: "var(--pw-border-strong)" }} />;
}
