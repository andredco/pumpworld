import { useEffect, useMemo, useState } from "react";
import { Scene } from "../three/Scene.js";
import { useWorld } from "../store/worldStore.js";
import { listRuns, type RunSummary } from "../net/replayClient.js";
import { usePlayback } from "../net/usePlayback.js";
import { HUD } from "./HUD.js";
import { TokenPanel } from "./TokenPanel.js";
import { CameraSwitcher } from "./CameraSwitcher.js";
import { PillInspector } from "./PillInspector.js";
import { Sidebar } from "./Sidebar.js";
import { DialogueStrip } from "./DialogueStrip.js";

const SPEEDS = [1, 2, 4, 8, 16, 32];

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
function fmtAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Replay({ onBack }: { onBack: () => void }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRuns().then(setRuns).catch(e => setError(e.message));
  }, []);

  if (pickedId) {
    return <Player runId={pickedId} onBack={() => setPickedId(null)} onHome={onBack} />;
  }

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(ellipse at top, #15203a 0%, #07090c 60%)",
      color: "var(--pw-text)",
      overflowY: "auto",
      padding: "24px 24px 64px",
    }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--pw-text-dim)", letterSpacing: 2, fontWeight: 700 }}>RECORDINGS</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 32, fontWeight: 800, letterSpacing: -0.6 }}>
              Replays of past worlds
            </h1>
            <div style={{ marginTop: 6, color: "var(--pw-text-dim)", fontSize: 14, maxWidth: 600, lineHeight: 1.5 }}>
              Every run of Pumpworld is recorded automatically: every move, every word, every death.
              Pick one to scrub through it inside the same 3D viewer.
            </div>
          </div>
          <button onClick={onBack} style={ghostBtn}>← Home</button>
        </div>

        {error && <div style={{ marginTop: 24, padding: 12, background: "rgba(244,114,114,0.08)", border: "1px solid rgba(244,114,114,0.2)", borderRadius: 8, color: "var(--pw-bad)" }}>Could not load recordings: {error}</div>}

        <div style={{ marginTop: 28, display: "grid", gap: 8 }}>
          {runs.length === 0 && !error && (
            <div style={{ padding: 18, background: "var(--pw-card)", border: "1px solid var(--pw-border)", borderRadius: 12, color: "var(--pw-text-dim)" }}>
              No recordings yet. Start the sim and it will create one.
            </div>
          )}
          {runs.map(r => {
            const playable = r.snapshots.length > 0 && r.eventBytes > 0;
            return (
              <button
                key={r.id}
                onClick={() => playable && setPickedId(r.id)}
                disabled={!playable}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 16,
                  padding: 16,
                  background: "var(--pw-card)",
                  border: "1px solid var(--pw-border)",
                  borderRadius: 12,
                  color: "var(--pw-text)",
                  textAlign: "left",
                  cursor: playable ? "pointer" : "not-allowed",
                  opacity: playable ? 1 : 0.55,
                  fontFamily: "inherit",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={e => playable && (e.currentTarget.style.background = "var(--pw-card-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--pw-card)")}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{r.seed}</span>
                    {r.isLive && (
                      <span style={{ padding: "1px 8px", borderRadius: 99, background: "rgba(124,212,162,0.14)", color: "var(--pw-good)", fontSize: 10, letterSpacing: 1.2, fontWeight: 700 }}>● LIVE</span>
                    )}
                    {!playable && (
                      <span style={{ color: "var(--pw-text-faint)", fontSize: 10, letterSpacing: 1.2 }}>NOT YET PLAYABLE</span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, color: "var(--pw-text-dim)", fontSize: 12 }}>
                    {fmtAgo(r.startedAt)} · {r.snapshots.length} snapshot{r.snapshots.length === 1 ? "" : "s"} · {fmtSize(r.eventBytes)} of events
                  </div>
                  <div className="pw-mono" style={{ marginTop: 4, color: "var(--pw-text-faint)", fontSize: 11 }}>
                    {r.id}
                  </div>
                </div>
                <span style={{
                  padding: "10px 18px",
                  background: playable ? "rgba(90,200,250,0.14)" : "transparent",
                  border: `1px solid ${playable ? "rgba(90,200,250,0.35)" : "var(--pw-border)"}`,
                  borderRadius: 99,
                  color: playable ? "var(--pw-text)" : "var(--pw-text-faint)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                }}>PLAY ▶</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Player({ runId, onBack, onHome }: { runId: string; onBack: () => void; onHome: () => void }) {
  const [playing, setPlaying] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  const speed = SPEEDS[speedIdx]!;
  const state = usePlayback({
    runId, speed, playing, seekTo,
    onSeekHandled: () => setSeekTo(null),
  });

  const lastTick = state.meta?.lastEventTick ?? 1;
  const progress = lastTick > 0 ? state.currentTick / lastTick : 0;
  const setSelected = useWorld(s => s.selectPill);

  // Cinematic frame on mount: orbit camera, deselect anything.
  useEffect(() => () => setSelected(null), [setSelected]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Scene />
      <TokenPanel />
      <HUD />
      <Sidebar />
      <PillInspector />
      <DialogueStrip />
      <CameraSwitcher />

      {/* Top-left replay badge */}
      <div style={{
        position: "absolute", top: 16, left: 290,
        padding: "8px 12px",
        background: "rgba(90,200,250,0.16)",
        border: "1px solid rgba(90,200,250,0.4)",
        borderRadius: 99,
        color: "var(--pw-text)",
        fontSize: 11, letterSpacing: 1.4, fontWeight: 700,
        display: "flex", alignItems: "center", gap: 6,
        backdropFilter: "blur(8px)",
      }}>
        ⟲ REPLAY
        <span style={{ color: "var(--pw-text-dim)", letterSpacing: 0, fontWeight: 500, marginLeft: 6 }}>
          {state.meta?.seed ?? runId}
        </span>
      </div>

      {/* Bottom playback bar */}
      <div style={{
        position: "absolute",
        left: 332, right: 332, bottom: 16,
        padding: "10px 14px",
        background: "var(--pw-card)",
        border: "1px solid var(--pw-border)",
        borderRadius: 12,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setPlaying(p => !p)} style={iconBtn}>
            {playing ? "❚❚" : "▶"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--pw-text-faint)", fontSize: 10, letterSpacing: 1.2, marginRight: 4 }}>SPEED</span>
            {SPEEDS.map((s, i) => (
              <button
                key={s}
                onClick={() => setSpeedIdx(i)}
                style={{
                  ...chip,
                  background: i === speedIdx ? "rgba(90,200,250,0.14)" : "transparent",
                  borderColor: i === speedIdx ? "rgba(90,200,250,0.4)" : "var(--pw-border)",
                  color: i === speedIdx ? "var(--pw-text)" : "var(--pw-text-dim)",
                }}
              >
                {s}×
              </button>
            ))}
          </div>
          <div className="pw-mono" style={{ color: "var(--pw-text-dim)", fontSize: 11, marginLeft: "auto" }}>
            tick {state.currentTick} / {lastTick}
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <input
            type="range"
            min={0}
            max={Math.max(1, lastTick)}
            value={scrubValue ?? state.currentTick}
            onChange={e => setScrubValue(Number(e.currentTarget.value))}
            onMouseUp={() => { if (scrubValue != null) { setSeekTo(scrubValue); setScrubValue(null); } }}
            onTouchEnd={() => { if (scrubValue != null) { setSeekTo(scrubValue); setScrubValue(null); } }}
            style={{ width: "100%", accentColor: "var(--pw-sky)" }}
          />
        </div>
        {state.loading && (
          <div style={{ marginTop: 4, color: "var(--pw-text-faint)", fontSize: 11 }}>loading…</div>
        )}
      </div>

      <div style={{
        position: "absolute", bottom: 16, right: 332,
        display: "flex", gap: 8,
      }}>
        <button onClick={onBack} style={cornerBtn}>← Recordings</button>
        <button onClick={onHome} style={cornerBtn}>← About</button>
      </div>

      <div style={{
        position: "absolute", top: 16, right: 332,
        color: "var(--pw-text-faint)", fontSize: 11,
      }}>
        {Math.round(progress * 100)}%
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid var(--pw-border-strong)",
  borderRadius: 99,
  color: "var(--pw-text)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.2,
  cursor: "pointer",
  fontFamily: "inherit",
};

const iconBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "rgba(90,200,250,0.14)",
  border: "1px solid rgba(90,200,250,0.4)",
  borderRadius: 8,
  color: "var(--pw-text)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const chip: React.CSSProperties = {
  padding: "5px 9px",
  border: "1px solid var(--pw-border)",
  borderRadius: 99,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  cursor: "pointer",
  fontFamily: "inherit",
};

const cornerBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "var(--pw-card)",
  border: "1px solid var(--pw-border)",
  borderRadius: 10,
  color: "var(--pw-text)",
  fontSize: 11,
  letterSpacing: 1,
  fontWeight: 600,
  cursor: "pointer",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  fontFamily: "inherit",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};
