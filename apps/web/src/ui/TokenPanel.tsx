import { useMemo } from "react";
import type { TokenStats } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";
import { TOKEN } from "./token.js";

function fmtUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n > 0) return `$${n.toExponential(2)}`;
  return "$0";
}
function fmtCount(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
function fmtPct(p: number): { text: string; tone: "up" | "down" | "flat" } {
  const tone = p > 0.5 ? "up" : p < -0.5 ? "down" : "flat";
  const sign = p > 0 ? "+" : "";
  return { text: `${sign}${p.toFixed(2)}%`, tone };
}

function dexFeedLabel(stats: TokenStats | undefined): string {
  if (!stats?.lastUpdatedMs || stats.priceUsd <= 0) return "INDEXING";
  const staleMs = 180_000;
  if (Date.now() - stats.lastUpdatedMs > staleMs) return "STALE";
  return "LIVE";
}

/**
 * Compact live market panel. Shows $PILLS from DexScreener (via the sim), Mood + Abundance in-world.
 */
export function TokenPanel() {
  const meta = useWorld(s => s.meta);
  const stats = meta?.tokenStats;
  const influence = meta?.tokenInfluence;

  const change24 = useMemo(() => fmtPct(stats?.priceChange24hPct ?? 0), [stats?.priceChange24hPct]);
  const change1h = useMemo(() => fmtPct(stats?.priceChange1hPct ?? 0), [stats?.priceChange1hPct]);

  const moodTone =
    influence == null ? "neutral" :
    influence.mood > 0.4 ? "euphoric" :
    influence.mood > 0.1 ? "rising" :
    influence.mood > -0.1 ? "calm" :
    influence.mood > -0.4 ? "anxious" : "despairing";
  const moodColor =
    moodTone === "euphoric" ? "var(--pw-good)" :
    moodTone === "rising"   ? "var(--pw-mint)" :
    moodTone === "calm"     ? "var(--pw-text-dim)" :
    moodTone === "anxious"  ? "var(--pw-warn)" :
    moodTone === "despairing" ? "var(--pw-bad)" : "var(--pw-text-dim)";

  return (
    <div className="pe-card" style={{
      position: "absolute", top: 70, right: 16,
      width: 280,
      padding: "16px 18px",
      borderRadius: "var(--pw-radius-md)",
      color: "var(--pw-text)",
      boxShadow: "var(--pw-shadow-md)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontSize: 18, fontWeight: 800, letterSpacing: -0.02,
            color: "var(--pw-accent)",
          }}>
            {TOKEN.symbol}
          </span>
          <span style={{ fontSize: 10, color: "var(--pw-text-faint)" }}>
            {TOKEN.launchVenue}
          </span>
        </div>
        <span style={{
          fontSize: 9, letterSpacing: "0.1em", color: "var(--pw-text-dim)",
          textTransform: "uppercase", fontWeight: 700,
          padding: "3px 8px", background: "var(--pw-accent-muted)",
          borderRadius: "var(--pw-radius-full)",
          border: "1px solid var(--pw-border)",
        }}>
          {dexFeedLabel(stats)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
        <div>
          <div className="pw-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--pw-text)", letterSpacing: -0.3, lineHeight: 1 }}>
            {fmtUsd(stats?.marketCapUsd ?? null)}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--pw-text-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Market cap
          </div>
        </div>
        <Spark values={stats?.spark ?? []} width={108} height={36} />
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Stat label="Price" value={fmtUsd(stats?.priceUsd ?? null)} />
        <Stat label="24h vol" value={fmtUsd(stats?.volume24hUsd ?? null)} />
        <Stat label="24h" value={change24.text} tone={change24.tone} />
        <Stat label="1h" value={change1h.text} tone={change1h.tone} />
        <Stat label="Holders" value={fmtCount(stats?.holders ?? null)} />
        <Stat label="Mood" value={moodTone} customColor={moodColor} />
      </div>

      <div style={{
        marginTop: 12, padding: "10px 12px",
        background: "var(--pw-bg-2)",
        border: "1px solid var(--pw-border)",
        borderRadius: "var(--pw-radius-sm)",
      }}>
        <div style={{ fontSize: 9, color: "var(--pw-text-faint)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          Town influence
        </div>
        <Bar label="abundance" value={(influence?.abundance ?? 1) / 2} display={(influence?.abundance ?? 1).toFixed(2) + "×"} />
        <Bar label="tension" value={influence?.volatility ?? 0} display={((influence?.volatility ?? 0) * 100).toFixed(0) + "%"} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone, customColor }: { label: string; value: string; tone?: "up" | "down" | "flat"; customColor?: string }) {
  const color =
    customColor ??
    (tone === "up" ? "var(--pw-good)" :
     tone === "down" ? "var(--pw-bad)" :
     "var(--pw-text)");
  return (
    <div style={{
      padding: "8px 10px",
      background: "var(--pw-bg-2)",
      border: "1px solid var(--pw-border)",
      borderRadius: "var(--pw-radius-sm)",
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--pw-text-faint)", textTransform: "uppercase" }}>{label}</div>
      <div className="pw-mono" style={{ fontSize: 13, fontWeight: 600, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Bar({ label, value, display }: { label: string; value: number; display: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, marginTop: 4 }}>
      <span style={{ width: 64, color: "var(--pw-text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "var(--pw-border)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          width: `${v * 100}%`, height: "100%",
          background: "var(--pw-accent)",
          transition: "width 200ms ease",
        }} />
      </div>
      <span className="pw-mono" style={{ width: 36, textAlign: "right", color: "var(--pw-text-dim)" }}>{display}</span>
    </div>
  );
}

function Spark({ values, width, height }: { values: number[]; width: number; height: number }) {
  if (values.length < 2) {
    return (
      <div style={{ width, height, opacity: 0.25, color: "var(--pw-text-faint)", fontSize: 9, alignSelf: "flex-end", textAlign: "right" }}>
        —
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || max || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const up = values[values.length - 1]! >= values[0]!;
  const color = up ? "var(--pw-good)" : "var(--pw-bad)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={up ? "rgba(74, 222, 128, 0.12)" : "rgba(248, 113, 113, 0.1)"}
        stroke="none"
      />
    </svg>
  );
}
