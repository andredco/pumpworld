import { BRAND_LOGO } from "../brand.js";
import { useWorld } from "../store/worldStore.js";
import { X_HANDLE, X_URL, XGlyph } from "./xLink.js";

export type NavTab = "live" | "characters" | "blogs";

interface Props {
  active: NavTab;
  onChange: (t: NavTab) => void;
  onAbout: () => void;
  onReplays: () => void;
}

/**
 * Full-width broadcast bar pinned to the top of the world view.
 * Three zones: brand + live status on the left, view tabs in the centre,
 * meta links (Replays / About / X) on the right.
 */
export function TopNav({ active, onChange, onAbout, onReplays }: Props) {
  const blogs = useWorld(s => s.blogPosts);
  const pulse = useWorld(s => s.blogPulse);
  const pills = useWorld(s => s.pills);
  const connected = useWorld(s => s.connected);
  const alive = [...pills.values()].filter(p => p.status !== "dead" && p.status !== "exiled").length;

  const tab = (id: NavTab): React.CSSProperties => ({
    padding: "7px 14px",
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
    <div style={{
      position: "absolute",
      top: 0, left: 0, right: 0,
      height: 54,
      zIndex: 50,
      display: "flex", alignItems: "center",
      padding: "0 16px",
      gap: 12,
      background: "linear-gradient(180deg, rgba(7,9,14,0.88), rgba(7,9,14,0.55))",
      borderBottom: "1px solid var(--pw-border)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
    }}>
      {/* left: brand + status */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontFamily: "var(--pw-mono)", fontWeight: 600, fontSize: 11,
          letterSpacing: "0.14em", color: "var(--pw-text)", textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: "var(--pw-accent)", display: "inline-block" }} />
          {BRAND_LOGO}
        </span>
        <span style={{
          padding: "2px 8px", fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          borderRadius: 99,
          background: connected ? "var(--pw-accent-muted)" : "rgba(245, 192, 68, 0.10)",
          color: connected ? "var(--pw-good)" : "#f5c044",
          border: `1px solid ${connected ? "rgba(74, 222, 128, 0.25)" : "rgba(245, 192, 68, 0.25)"}`,
          whiteSpace: "nowrap",
        }}>
          {connected ? "● LIVE" : "STANDBY"}
        </span>
      </div>

      {/* centre: view tabs */}
      <div className="pe-glass-bar" style={{ padding: 4, gap: 2, display: "flex" }}>
        <button style={tab("live")} onClick={() => onChange("live")}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--pw-good)" }} />
          Live
        </button>
        <button style={tab("characters")} onClick={() => onChange("characters")}>
          Souls <Badge>{alive}</Badge>
        </button>
        <button style={tab("blogs")} onClick={() => onChange("blogs")}>
          Blogs {blogs.size > 0 && <Badge>{blogs.size}</Badge>}
        </button>
      </div>

      {/* right: meta links */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
        <button style={metaLink} onClick={onReplays}>⟲ Replays</button>
        <button style={metaLink} onClick={onAbout}>About</button>
        <a
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer"
          title={`Follow @${X_HANDLE} on X`}
          aria-label={`Follow @${X_HANDLE} on X`}
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
    </div>
  );
}

const metaLink: React.CSSProperties = {
  padding: "7px 12px",
  background: "transparent",
  border: "none",
  borderRadius: 99,
  color: "var(--pw-text-dim)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};

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
