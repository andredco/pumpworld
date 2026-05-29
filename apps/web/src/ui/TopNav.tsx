import { useWorld } from "../store/worldStore.js";
import { X_URL, XGlyph } from "./xLink.js";

export type NavTab = "live" | "characters" | "blogs";

interface Props {
  active: NavTab;
  onChange: (t: NavTab) => void;
  onAbout: () => void;
  onReplays: () => void;
}

export function TopNav({ active, onChange, onAbout, onReplays }: Props) {
  const blogs = useWorld(s => s.blogPosts);
  const pulse = useWorld(s => s.blogPulse);
  const pills = useWorld(s => s.pills);
  const alive = [...pills.values()].filter(p => p.status !== "dead" && p.status !== "exiled").length;

  const tab = (id: NavTab, label: string, badge?: number, pulsing?: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    background: active === id ? "var(--pw-accent-muted)" : "transparent",
    border: "none",
    borderRadius: 99,
    color: active === id ? "var(--pw-text)" : "var(--pw-text-dim)",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.02,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 140ms ease",
    display: "flex", alignItems: "center", gap: 6,
    position: "relative",
  });
  void pulse; // keep render in sync but not used directly here

  return (
    <div className="pe-glass-bar" style={{
      position: "absolute",
      top: 16, left: "50%",
      transform: "translateX(-50%)",
      padding: 4,
      gap: 2,
      zIndex: 50,
    }}>
      <button style={tab("live", "Live")} onClick={() => onChange("live")}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--pw-good)" }} />
        Live
      </button>
      <button style={tab("characters", "Pills")} onClick={() => onChange("characters")}>
        Pills <Badge>{alive}</Badge>
      </button>
      <button style={tab("blogs", "Blogs")} onClick={() => onChange("blogs")}>
        Blogs {blogs.size > 0 && <Badge>{blogs.size}</Badge>}
      </button>
      <span style={{ width: 1, height: 20, background: "var(--pw-border)", margin: "0 4px" }} />
      <button style={tab("live" as NavTab, "Replays")} onClick={onReplays}>⟲ Replays</button>
      <button style={tab("live" as NavTab, "About")} onClick={onAbout}>About</button>
      <a
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Follow @thepillexperiment on X"
        aria-label="Follow @thepillexperiment on X"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32, height: 32,
          marginLeft: 2,
          borderRadius: 99,
          color: "var(--pw-text-dim)",
          textDecoration: "none",
          transition: "all 140ms ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = "var(--pw-text)";
          e.currentTarget.style.background = "rgba(255,255,255,0.10)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = "var(--pw-text-dim)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <XGlyph size={13} />
      </a>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding: "1px 6px",
      background: "rgba(255,255,255,0.12)",
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 700,
      color: "var(--pw-text)",
    }}>{children}</span>
  );
}
