import { useEffect, useMemo, useRef, useState } from "react";
import { useWorld, type CameraMode } from "../store/worldStore.js";
import { PillAvatar } from "./PillAvatar.js";

const STATIC_MODES: { id: CameraMode; label: string }[] = [
  { id: "orbit", label: "Orbit" },
  { id: "overhead", label: "Overhead" },
];

export function CameraSwitcher() {
  const mode = useWorld(s => s.cameraMode);
  const followPillId = useWorld(s => s.followPillId);
  const setCamera = useWorld(s => s.setCamera);
  const pills = useWorld(s => s.pills);
  const selectPill = useWorld(s => s.selectPill);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const followingPill = followPillId ? pills.get(followPillId) : null;
  const pillList = useMemo(
    () => [...pills.values()]
      .filter(p => p.status !== "dead" && p.status !== "exiled")
      .sort((a, b) => a.name.localeCompare(b.name)),
    [pills],
  );

  const wrap: React.CSSProperties = {
    position: "absolute", bottom: 16, left: 16,
    padding: 6,
    background: "var(--pw-card)",
    border: "1px solid var(--pw-border)",
    borderRadius: 12,
    color: "var(--pw-text)",
    fontSize: 12,
    display: "flex", gap: 4, alignItems: "center",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
  };
  const btn = (active: boolean, disabled = false): React.CSSProperties => ({
    padding: "8px 14px",
    background: active ? "rgba(90,200,250,0.16)" : "transparent",
    border: "1px solid " + (active ? "rgba(90,200,250,0.4)" : "transparent"),
    color: disabled ? "var(--pw-text-faint)" : active ? "var(--pw-text)" : "var(--pw-text-dim)",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
    fontFamily: "inherit",
    transition: "all 120ms ease",
    display: "flex", alignItems: "center", gap: 6,
  });

  return (
    <div ref={ref} style={wrap}>
      {STATIC_MODES.map(m => (
        <button key={m.id} style={btn(mode === m.id)} onClick={() => setCamera(m.id, null)}>
          {m.label}
        </button>
      ))}
      <div style={{ position: "relative" }}>
        <button
          style={btn(mode === "follow")}
          onClick={() => setOpen(o => !o)}
          disabled={pillList.length === 0}
        >
          {followingPill ? (
            <>
              <PillAvatar pill={followingPill} size={16} withFace />
              <span>Follow · {followingPill.name}</span>
            </>
          ) : (
            <>Follow</>
          )}
          <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>▾</span>
        </button>
        {open && (
          <div style={dropdownStyle}>
            <div style={dropHeader}>Follow a pill</div>
            {pillList.map(p => {
              const isCurrent = followPillId === p.id && mode === "follow";
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    selectPill(p.id);
                    setCamera("follow", p.id);
                    setOpen(false);
                  }}
                  style={{ ...dropItem, background: isCurrent ? "rgba(90,200,250,0.10)" : "transparent" }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                >
                  <PillAvatar pill={p} size={18} withFace />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", overflow: "hidden" }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: "var(--pw-text-faint)" }}>{p.soul.label} · {p.role.vocation}</span>
                  </div>
                </button>
              );
            })}
            {followingPill && (
              <>
                <div style={dropDivider} />
                <button
                  onClick={() => { setCamera("orbit", null); setOpen(false); }}
                  style={{ ...dropItem, color: "var(--pw-text-dim)", justifyContent: "center" }}
                >
                  ✕ Stop following
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 8px)", left: 0,
  minWidth: 220,
  padding: 4,
  background: "rgba(7,9,12,0.96)",
  border: "1px solid var(--pw-border)",
  borderRadius: 10,
  boxShadow: "0 16px 36px rgba(0,0,0,0.55)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  display: "flex", flexDirection: "column", gap: 2,
};
const dropHeader: React.CSSProperties = {
  padding: "6px 10px 4px",
  fontSize: 9, letterSpacing: 1.4, color: "var(--pw-text-faint)",
  textTransform: "uppercase", fontWeight: 800,
};
const dropItem: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  color: "var(--pw-text)",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  transition: "background 120ms ease",
};
const dropDivider: React.CSSProperties = {
  height: 1, background: "var(--pw-border)", margin: "4px 2px",
};
