import { useMemo } from "react";
import type { BlogPost, Pill } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";
import { PillAvatar } from "./PillAvatar.js";
import { isPillsCurrencyName } from "../util/pillsCurrency.js";

interface Props {
  onClose: () => void;
  onFollow: (pillId: string) => void;
  onOpenBlogs: () => void;
}

const STATUS_DOT: Record<string, string> = {
  alive: "#7cd4a2",
  sleeping: "#6ab0d4",
  incarcerated: "#f0c674",
  awaiting_execution: "#f47272",
  unconscious: "#aaa",
  exiled: "#a0a0a0",
  dead: "#f47272",
};

export function Characters({ onClose, onFollow, onOpenBlogs }: Props) {
  const pills = useWorld(s => s.pills);
  const buildings = useWorld(s => s.buildings);
  const items = useWorld(s => s.items);
  const blogs = useWorld(s => s.blogPosts);

  const list = useMemo(
    () => [...pills.values()].sort((a, b) =>
      Number(a.status === "dead") - Number(b.status === "dead") ||
      a.name.localeCompare(b.name)
    ),
    [pills],
  );

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "#06070b",
      overflowY: "auto",
      zIndex: 40,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at top, #14182a 0%, #06070b 60%)",
        pointerEvents: "none",
      }} />
      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto", padding: "92px 24px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--pw-text-dim)", letterSpacing: 2, fontWeight: 700 }}>THE CAST</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 36, fontWeight: 800, letterSpacing: -0.6 }}>The six pills</h1>
            <p style={{ marginTop: 8, color: "var(--pw-text-dim)", maxWidth: 640, lineHeight: 1.5 }}>
              Each pill is run by a different AI model. They don't know what the others are. They only know each other through the world.
            </p>
          </div>
          <button onClick={onClose} style={closeBtn}>Close ✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
          {list.map(p => (
            <CharacterCard
              key={p.id}
              pill={p}
              homeName={p.homeBuildingId ? buildings.get(p.homeBuildingId)?.name : null}
              workName={p.workBuildingId ? buildings.get(p.workBuildingId)?.name : null}
              pillsInPocket={pillsInPocket(p, items)}
              postCount={[...blogs.values()].filter(b => b.authorPillId === p.id).length}
              latestPost={[...blogs.values()].filter(b => b.authorPillId === p.id).sort((a, b) => b.publishedAtMs - a.publishedAtMs)[0] ?? null}
              onFollow={() => { onFollow(p.id); onClose(); }}
              onOpenBlogs={onOpenBlogs}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function pillsInPocket(p: Pill, items: Map<string, { kind: string; name: string; potency?: number }>): number {
  let total = 0;
  for (const e of p.inventory) {
    const it = items.get(e.itemId);
    if (it && it.kind === "currency" && isPillsCurrencyName(it.name)) total += it.potency ?? 0;
  }
  return Math.round(total);
}

function CharacterCard({ pill, homeName, workName, pillsInPocket, postCount, latestPost, onFollow, onOpenBlogs }: {
  pill: Pill;
  homeName: string | null | undefined;
  workName: string | null | undefined;
  pillsInPocket: number;
  postCount: number;
  latestPost: BlogPost | null;
  onFollow: () => void;
  onOpenBlogs: () => void;
}) {
  const dead = pill.status === "dead" || pill.status === "exiled";
  return (
    <div style={{
      background: "var(--pw-card)",
      border: `1px solid ${dead ? "var(--pw-border)" : pill.shell.topColor + "55"}`,
      borderRadius: 16,
      padding: 18,
      opacity: dead ? 0.65 : 1,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <PillAvatar pill={pill} size={56} withFace />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>{pill.name}</div>
          <div style={{ fontSize: 12, color: "var(--pw-text-dim)", marginTop: 2 }}>
            {pill.soul.label}
          </div>
          <div style={{ fontSize: 12, marginTop: 6, color: "var(--pw-text-dim)" }}>
            <span style={{ textTransform: "capitalize", color: "var(--pw-text)" }}>{pill.gender}</span> · {pill.role.vocation}
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: STATUS_DOT[pill.status] ?? "var(--pw-text-dim)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: STATUS_DOT[pill.status] ?? "var(--pw-text-dim)" }} />
            {pill.status}
          </div>
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11,
      }}>
        <KV k="HOME" v={homeName ?? "-"} />
        <KV k="WORK" v={workName ?? "-"} />
        <KV k="$PILLS" v={String(pillsInPocket)} gold />
        <KV k="NOTORIETY" v={pill.role.notoriety.toFixed(2)} />
      </div>

      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--pw-text-faint)", textTransform: "uppercase", marginBottom: 6 }}>CURRENT TASK</div>
        <div style={{ fontSize: 13, color: "var(--pw-text)", fontStyle: "italic" }}>{pill.currentTask || "-"}</div>
      </div>

      {latestPost && (
        <div style={{
          padding: "10px 12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--pw-border)",
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--pw-text-faint)", textTransform: "uppercase", marginBottom: 4 }}>
            Latest blog · {postCount} total
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{latestPost.title}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--pw-text-dim)", lineHeight: 1.4, maxHeight: "2.8em", overflow: "hidden" }}>
            {latestPost.body.split("\n").filter(Boolean)[0]?.slice(0, 160)}…
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button onClick={onFollow} disabled={dead} style={primaryBtn}>Follow ▶</button>
        <button onClick={onOpenBlogs} style={ghostBtn}>Blog</button>
      </div>
    </div>
  );
}

function KV({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div style={{
      padding: "6px 8px",
      background: gold ? "rgba(255,210,63,0.06)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${gold ? "rgba(255,210,63,0.18)" : "var(--pw-border)"}`,
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--pw-text-faint)", textTransform: "uppercase" }}>{k}</div>
      <div className="pw-mono" style={{ fontSize: 13, fontWeight: 600, color: gold ? "var(--pw-gold)" : "var(--pw-text)" }}>{v}</div>
    </div>
  );
}

const closeBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid var(--pw-border-strong)",
  borderRadius: 99,
  color: "var(--pw-text)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  cursor: "pointer",
  fontFamily: "inherit",
};
const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  background: "rgba(90,200,250,0.16)",
  border: "1px solid rgba(90,200,250,0.4)",
  borderRadius: 10,
  color: "var(--pw-text)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const ghostBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid var(--pw-border)",
  borderRadius: 10,
  color: "var(--pw-text)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};
