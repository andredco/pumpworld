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
  if (n > 0) {
    const e = n.toExponential(2);
    return `$${e}`;
  }
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
    moodTone === "euphoric" ? "#9af075" :
    moodTone === "rising"   ? "#7cd4a2" :
    moodTone === "calm"     ? "#cdd6e0" :
    moodTone === "anxious"  ? "#f0c674" :
    moodTone === "despairing" ? "#f47272" : "#cdd6e0";

  return (
    <div style={{
      position: "absolute", top: 76, left: 16,
      width: 280,
      padding: "14px 16px",
      background: "linear-gradient(180deg, rgba(20,16,8,0.92), rgba(7,9,12,0.86))",
      border: "1px solid rgba(255,210,63,0.18)",
      borderRadius: 14,
      color: "var(--pw-text)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      boxShadow: "0 16px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,210,63,0.06) inset",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontSize: 19, fontWeight: 900, letterSpacing: 0.2,
            background: "linear-gradient(90deg, #ffd23f 0%, #ff9a4a 50%, #ff5577 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>
            {TOKEN.symbol}
          </span>
          <span style={{ fontSize: 10, color: "var(--pw-text-faint)", letterSpacing: 0.4 }}>
            on {TOKEN.launchVenue}
          </span>
        </div>
        <span style={{
          fontSize: 9, letterSpacing: 1.4, color: "var(--pw-warn)",
          textTransform: "uppercase", fontWeight: 800,
          padding: "2px 7px", background: "rgba(240,198,116,0.10)",
          borderRadius: 99, border: "1px solid rgba(240,198,116,0.3)",
        }}>
          {dexFeedLabel(stats)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
        <div>
          <div className="pw-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--pw-text)", letterSpacing: -0.3, lineHeight: 1 }}>
            {fmtUsd(stats?.marketCapUsd ?? null)}
          </div>
          <div style={{ marginTop: 2, fontSize: 10, color: "var(--pw-text-faint)", letterSpacing: 1.2, textTransform: "uppercase" }}>
            Market Cap
          </div>
        </div>
        <Spark values={stats?.spark ?? []} width={108} height={36} />
      </div>

      <div style={{
        marginTop: 10,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
      }}>
        <Stat label="PRICE"   value={fmtUsd(stats?.priceUsd ?? null)} />
        <Stat label="24h VOL" value={fmtUsd(stats?.volume24hUsd ?? null)} />
        <Stat label="24h" value={change24.text} tone={change24.tone} />
        <Stat label="1h"  value={change1h.text} tone={change1h.tone} />
        <Stat label="HOLDERS" value={fmtCount(stats?.holders ?? null)} />
        <Stat label="MOOD" value={moodTone} customColor={moodColor} />
      </div>

      <div style={{
        marginTop: 10, padding: "8px 10px",
        background: "rgba(255,210,63,0.05)",
        border: "1px solid rgba(255,210,63,0.14)",
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 9, color: "var(--pw-text-faint)", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>
          Town influence
        </div>
        <Bar label="abundance" value={(influence?.abundance ?? 1) / 2} display={(influence?.abundance ?? 1).toFixed(2) + "×"} />
        <Bar label="tension"   value={influence?.volatility ?? 0} display={((influence?.volatility ?? 0) * 100).toFixed(0) + "%"} />
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
      padding: "6px 9px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid var(--pw-border)",
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--pw-text-faint)", textTransform: "uppercase" }}>{label}</div>
      <div className="pw-mono" style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function Bar({ label, value, display }: { label: string; value: number; display: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, marginTop: 4 }}>
      <span style={{ width: 64, color: "var(--pw-text-faint)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          width: `${v * 100}%`, height: "100%",
          background: "linear-gradient(90deg, #ffd23f, #ff9a4a)",
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
        ─ ─ ─
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
        fill={up ? "rgba(124,212,162,0.15)" : "rgba(244,114,114,0.12)"}
        stroke="none"
      />
    </svg>
  );
}
