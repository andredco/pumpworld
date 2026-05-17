import { useMemo } from "react";
import { useWorld } from "../store/worldStore.js";

const STATUS_ORDER: Record<string, number> = {
  alive: 0, sleeping: 1, incarcerated: 2, exiled: 3, unconscious: 4, dead: 5,
};

const STATUS_DOT: Record<string, string> = {
  alive: "#7cd4a2", sleeping: "#6ab0d4", incarcerated: "#f0c674",
  unconscious: "#aaa", exiled: "#a0a0a0", dead: "#f47272",
};

export function CharactersPanel() {
  const pills = useWorld(s => s.pills);
  const selectedId = useWorld(s => s.selectedPillId);
  const selectPill = useWorld(s => s.selectPill);
  const setCamera = useWorld(s => s.setCamera);

  const list = useMemo(() => {
    return [...pills.values()].sort((a, b) => {
      const sd = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (sd !== 0) return sd;
      return a.name.localeCompare(b.name);
    });
  }, [pills]);

  return (
    <div style={{
      padding: "6px 0",
      fontSize: 12,
      overflowY: "auto",
      flex: 1,
    }}>
      {list.map(p => {
        const isSelected = selectedId === p.id;
        const dead = p.status === "dead" || p.status === "exiled";
        return (
          <button
            key={p.id}
            onClick={() => {
              selectPill(p.id);
              if (!dead) setCamera("follow", p.id);
            }}
            style={{
              display: "grid",
              gridTemplateColumns: "20px 1fr auto",
              gap: 10,
              alignItems: "center",
              width: "100%",
              padding: "8px 12px",
              background: isSelected ? "rgba(90,200,250,0.10)" : "transparent",
              border: "none",
              borderLeft: `3px solid ${isSelected ? p.shell.topColor : "transparent"}`,
              color: dead ? "var(--pw-text-faint)" : "var(--pw-text)",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              fontSize: 12,
              transition: "background 120ms ease",
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{
              width: 14, height: 18, borderRadius: 7,
              background: `linear-gradient(180deg, ${p.shell.topColor} 50%, ${p.shell.bottomColor} 50%)`,
              border: "1px solid rgba(0,0,0,0.45)",
              boxShadow: isSelected ? `0 0 0 2px ${p.shell.topColor}33` : "none",
              opacity: dead ? 0.4 : 1,
            }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: "var(--pw-text-dim)", marginLeft: 6, fontSize: 11 }}>
                {p.soul.label} · {p.role.vocation}
              </span>
            </span>
            <span style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 9, color: STATUS_DOT[p.status] ?? "#aaa",
              textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 99,
                background: STATUS_DOT[p.status] ?? "#aaa",
              }} />
              {p.status}
            </span>
          </button>
        );
      })}
      {list.length === 0 && <div style={{ padding: "12px 14px", color: "var(--pw-text-faint)" }}>No characters yet.</div>}
    </div>
  );
}
