import pillWorldSource from "../../../../../docs/PILL_WORLD.md?raw";
import architectureSource from "../../../../../docs/ARCHITECTURE.md?raw";
import agentsSource from "../../../../../AGENTS.md?raw";
import { MarkdownReader } from "./MarkdownReader.js";
import {
  DOC_PBORDER,
  DOC_PDIM,
  DOC_PG,
  DOC_PBG,
  DOC_PTEXT,
} from "./docTheme.js";

export type DocsRouteKey = "docs" | "docs/spec" | "docs/architecture" | "docs/agents";

interface Props {
  route: DocsRouteKey;
  onBack: () => void;
}

/** Maps URL hash (without #) to a supported docs page; unknown paths fall back to overview. */
export function publicDocsRouteFromHash(hashRoute: string): DocsRouteKey {
  if (hashRoute === "docs/token") return "docs";
  if (
    hashRoute === "docs"
    || hashRoute === "docs/spec"
    || hashRoute === "docs/architecture"
    || hashRoute === "docs/agents"
  ) return hashRoute as DocsRouteKey;
  return "docs";
}

const shellPad = { maxWidth: 920, margin: "0 auto", padding: "28px 28px 100px" } as const;

const btnGhost = {
  border: `1px solid ${DOC_PBORDER}`,
  background: "transparent",
  color: DOC_PDIM,
  borderRadius: 99,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

const cardStyle = {
  display: "block",
  padding: "22px 22px",
  borderRadius: 14,
  border: `1px solid ${DOC_PBORDER}`,
  background: "#0a0d10",
  textDecoration: "none",
  color: DOC_PTEXT,
  transition: "border-color 0.15s ease",
} as const;

export function PublicDocs({ route, onBack }: Props) {
  const key = publicDocsRouteFromHash(route);
  const title = (
    <span style={{ fontFamily: "var(--pw-mono, monospace)", fontWeight: 800, fontSize: 13 }}>
      Pill World docs
    </span>
  );

  const nav = (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      marginBottom: key === "docs" ? 36 : 28,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button type="button" style={btnGhost} onClick={onBack}>← Back</button>
        {title}
      </div>
      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
        <a href="#docs" style={{ color: key === "docs" ? DOC_PG : DOC_PDIM }}>Overview</a>
        <a href="#docs/spec" style={{ color: key === "docs/spec" ? DOC_PG : DOC_PDIM }}>Technical spec</a>
        <a href="#docs/architecture" style={{ color: key === "docs/architecture" ? DOC_PG : DOC_PDIM }}>Architecture</a>
        <a href="#docs/agents" style={{ color: key === "docs/agents" ? DOC_PG : DOC_PDIM }}>Agent constitution</a>
      </nav>
    </header>
  );

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: DOC_PBG,
      color: DOC_PTEXT,
      overflowY: "auto",
      fontFamily: "inherit",
    }}>
      <main style={shellPad}>
        {nav}

        {key === "docs" && (
          <>
            <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, letterSpacing: -1, margin: "0 0 12px" }}>
              Documentation
            </h1>
            <p style={{ maxWidth: 640, color: DOC_PDIM, fontSize: 16, lineHeight: 1.55, marginBottom: 36 }}>
              Readable references for how Pill World works. Ops runbooks, API keys, and{' '}
              <strong style={{ color: DOC_PTEXT }}>.env</strong> layouts stay private — nothing here is copy-paste
              infrastructure.
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}>
              <a href="#docs/spec" style={cardStyle}>
                <div style={{ color: DOC_PG, fontSize: 11, letterSpacing: 1.4, fontWeight: 700, marginBottom: 8 }}>
                  SPEC
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Technical specification</div>
                <div style={{ color: DOC_PDIM, fontSize: 14, lineHeight: 1.45 }}>
                  Simulation model, market coupling, math appendix (Spring, needs, mood).
                </div>
              </a>
              <a href="#docs/architecture" style={cardStyle}>
                <div style={{ color: DOC_PG, fontSize: 11, letterSpacing: 1.4, fontWeight: 700, marginBottom: 8 }}>
                  SYSTEM
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Architecture</div>
                <div style={{ color: DOC_PDIM, fontSize: 14, lineHeight: 1.45 }}>
                  Tick loop, WebSocket viewer, replay snapshots — where to extend the codebase.
                </div>
              </a>
              <a href="#docs/agents" style={cardStyle}>
                <div style={{ color: DOC_PG, fontSize: 11, letterSpacing: 1.4, fontWeight: 700, marginBottom: 8 }}>
                  LORE
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Agent constitution</div>
                <div style={{ color: DOC_PDIM, fontSize: 14, lineHeight: 1.45 }}>
                  The in-character rules every pill sees — violence, law, blogs, mortality.
                </div>
              </a>
            </div>
          </>
        )}

        {key === "docs/spec" && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>Pill World specification</h1>
            <p style={{ color: DOC_PDIM, marginBottom: 28, fontSize: 14 }}>
              Canonical technical description + mathematical appendix.
            </p>
            <MarkdownReader markdown={pillWorldSource} />
          </>
        )}

        {key === "docs/architecture" && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>Architecture</h1>
            <p style={{ color: DOC_PDIM, marginBottom: 28, fontSize: 14 }}>
              Sim server vs viewer, tick ordering, protocol boundaries.
            </p>
            <MarkdownReader markdown={architectureSource} />
          </>
        )}

        {key === "docs/agents" && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>AGENTS.md</h1>
            <p style={{ color: DOC_PDIM, marginBottom: 28, fontSize: 14 }}>
              Constitution injected into every pill's system prompt (creative sandbox rules).
            </p>
            <MarkdownReader markdown={agentsSource} />
          </>
        )}
      </main>
    </div>
  );
}
