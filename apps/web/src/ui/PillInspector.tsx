import { useWorld } from "../store/worldStore.js";
import { isPillsCurrencyName } from "../util/pillsCurrency.js";
import { TOKEN } from "./token.js";
// useWorld.getState() lets us peek without subscribing for an enable/disable check

const STAT_COLOR = (v: number) =>
  v > 0.6 ? "var(--pw-good)" : v > 0.3 ? "var(--pw-warn)" : "var(--pw-bad)";

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, margin: "3px 0" }}>
      <div style={{ width: 56, color: "var(--pw-text-dim)", textTransform: "uppercase", letterSpacing: 1, fontSize: 10 }}>{label}</div>
      <div style={{
        flex: 1, height: 5,
        background: "rgba(255,255,255,0.05)", borderRadius: 99,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${Math.round(value * 100)}%`, height: "100%",
          background: STAT_COLOR(value),
          transition: "width 200ms ease",
        }} />
      </div>
      <div className="pw-mono" style={{ width: 32, textAlign: "right", color: "var(--pw-text-dim)", fontSize: 11 }}>{value.toFixed(2)}</div>
    </div>
  );
}

export function PillInspector() {
  const selectedId = useWorld(s => s.selectedPillId);
  const pills = useWorld(s => s.pills);
  const buildings = useWorld(s => s.buildings);
  const items = useWorld(s => s.items);
  const brains = useWorld(s => s.brains);
  const selectPill = useWorld(s => s.selectPill);
  const setCamera = useWorld(s => s.setCamera);
  const cameraMode = useWorld(s => s.cameraMode);
  if (!selectedId) return null;
  const pill = pills.get(selectedId);
  if (!pill) return null;
  const brain = brains.get(pill.id);
  const home = pill.homeBuildingId ? buildings.get(pill.homeBuildingId) : null;
  const work = pill.workBuildingId ? buildings.get(pill.workBuildingId) : null;

  // $PILLS shards in inventory
  const inventoryDescribed = pill.inventory.map(e => {
    const it = items.get(e.itemId);
    return it ? { name: it.name, kind: it.kind, potency: it.potency ?? 0 } : null;
  }).filter(Boolean) as { name: string; kind: string; potency: number }[];
  const pillsInPocket = inventoryDescribed
    .filter(i => i.kind === "currency" && isPillsCurrencyName(i.name))
    .reduce((s, i) => s + i.potency, 0);
  const hasWeapon = !!pill.weaponItemId;

  return (
    <div style={{
      position: "absolute", right: 16, bottom: 76,
      width: 290,
      zIndex: 40,
      background: "var(--pw-card)",
      border: `1px solid ${pill.shell.topColor}55`,
      borderRadius: "var(--pw-radius-md)",
      color: "var(--pw-text)",
      padding: 14,
      fontSize: 12,
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      maxHeight: "min(70vh, 540px)",
      overflowY: "auto",
      boxShadow: "var(--pw-shadow-md)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{pill.name}</div>
          <div style={{ fontSize: 11, color: "var(--pw-text-dim)", marginTop: 2 }}>
            {pill.soul.label} · {pill.gender} · {pill.role.vocation}
          </div>
        </div>
        <button
          onClick={() => selectPill(null)}
          style={{
            background: "transparent", border: "1px solid var(--pw-border)",
            color: "var(--pw-text-dim)", padding: "2px 8px",
            borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1,
          }}
        >×</button>
      </div>

      <div style={{
        marginTop: 12, padding: "10px 12px",
        background: "rgba(255,255,255,0.03)", borderRadius: 8,
        display: "grid", gridTemplateColumns: "80px 1fr", rowGap: 5, columnGap: 10, fontSize: 12,
      }}>
        <span style={{ color: "var(--pw-text-faint)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>HOME</span>
        <span>{home ? home.name : <span style={{ opacity: 0.4 }}>(none)</span>}</span>
        <span style={{ color: "var(--pw-text-faint)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>WORK</span>
        <span>{work ? work.name : <span style={{ opacity: 0.4 }}>(none)</span>}</span>
        <span style={{ color: "var(--pw-text-faint)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>TASK</span>
        <span style={{ fontStyle: "italic", color: "var(--pw-text-dim)" }}>{pill.currentTask || "(none)"}</span>
        <span style={{ color: "var(--pw-text-faint)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>WEAPON</span>
        <span>{hasWeapon ? <b style={{ color: "var(--pw-bad)" }}>● armed</b> : <span style={{ color: "var(--pw-text-faint)" }}>unarmed</span>}</span>
        <span style={{ color: "var(--pw-text-faint)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>{TOKEN.symbol}</span>
        <span className="pw-mono" style={{ color: "var(--pw-gold)", fontWeight: 700 }}>{pillsInPocket}</span>
        <span style={{ color: "var(--pw-text-faint)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>STATUS</span>
        <span>
          <b>{pill.status}</b>
          <span style={{ color: "var(--pw-text-faint)", marginLeft: 8 }}>notoriety {pill.role.notoriety.toFixed(2)}</span>
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <Bar label="health"  value={pill.health} />
        <Bar label="hunger"  value={pill.needs.hunger} />
        <Bar label="energy"  value={pill.needs.energy} />
        <Bar label="social"  value={pill.needs.social} />
        <Bar label="safety"  value={pill.needs.safety} />
        <Bar label="purpose" value={pill.needs.purpose} />
      </div>

      <div style={{
        marginTop: 12, padding: 10,
        background: "rgba(255,255,255,0.03)", borderRadius: 8,
      }}>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--pw-text-faint)", marginBottom: 4, textTransform: "uppercase" }}>
          INNER MONOLOGUE
        </div>
        <div style={{ fontStyle: "italic", color: "var(--pw-text)", minHeight: 32, fontSize: 12 }}>
          {brain ? brain.thought : <span style={{ opacity: 0.4 }}>(no recent thought)</span>}
        </div>
        {brain?.intent && (
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--pw-text-dim)" }}>
            → intent: <span className="pw-mono">{brain.intent}</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--pw-text-faint)", marginBottom: 4, textTransform: "uppercase" }}>
          RELATIONSHIPS
        </div>
        {pill.relationships.length === 0 && <div style={{ color: "var(--pw-text-faint)", fontSize: 11 }}>(none yet)</div>}
        {pill.relationships.slice(0, 8).map(r => {
          const other = pills.get(r.with);
          return (
            <div key={r.with} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
              <span>{other?.name ?? r.with.slice(0, 6)}</span>
              <span style={{ color: r.affinity > 0 ? "var(--pw-good)" : r.affinity < 0 ? "var(--pw-bad)" : "var(--pw-text-dim)" }}>
                {r.tag} · {r.affinity.toFixed(2)} / {r.trust.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={() => setCamera("follow", pill.id)}
          disabled={cameraMode === "follow" && useWorld.getState().followPillId === pill.id}
          style={camBtn}
        >▶ Follow {pill.name}</button>
      </div>
    </div>
  );
}

const camBtn: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  background: "transparent",
  border: "1px solid var(--pw-border-strong)",
  color: "var(--pw-text)",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  fontFamily: "inherit",
};
