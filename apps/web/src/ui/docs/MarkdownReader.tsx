import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import {
  DOC_PBORDER,
  DOC_PDIM,
  DOC_PG,
  DOC_PBG2,
  DOC_PTEXT,
} from "./docTheme.js";

const INTERNAL_MD: Record<string, string> = {
  "PILL_WORLD.md": "#docs/spec",
  "ARCHITECTURE.md": "#docs/architecture",
  "AGENTS.md": "#docs/agents",
};

function resolveMdHref(href: string | undefined): "omit" | { external: string } | { hash: string } {
  if (!href) return "omit";
  if (/^https?:\/\//i.test(href)) return { external: href };
  const tail = href.replace(/^(\.\/|\.\.\/)+/, "").split("/").pop() ?? href;
  const mapped = INTERNAL_MD[tail];
  if (mapped) return { hash: mapped };
  if (href.endsWith(".md")) return "omit";
  return { external: href };
}

function markdownComponents(): Components {
  return {
    a({ href, children, ...props }) {
      const r = resolveMdHref(href);
      if (r === "omit") {
        return (
          <span
            style={{ color: DOC_PDIM, cursor: "help", borderBottom: `1px dotted ${DOC_PBORDER}` }}
            title="Not published on this site"
          >
            {children}
          </span>
        );
      }
      if ("hash" in r) {
        return (
          <a href={r.hash} style={{ color: DOC_PG }} {...props}>
            {children}
          </a>
        );
      }
      return (
        <a href={r.external} style={{ color: DOC_PG }} target="_blank" rel="noreferrer" {...props}>
          {children}
        </a>
      );
    },
    h1: ({ children }) => (
      <h1 style={{
        fontSize: "2rem",
        fontWeight: 800,
        letterSpacing: -0.5,
        margin: "2.2rem 0 0.75rem",
        color: DOC_PTEXT,
      }}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 style={{
        fontSize: "1.35rem",
        fontWeight: 700,
        margin: "2rem 0 0.6rem",
        paddingBottom: 6,
        borderBottom: `1px solid ${DOC_PBORDER}`,
        color: DOC_PTEXT,
      }}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 style={{
        fontSize: "1.1rem",
        fontWeight: 650,
        margin: "1.4rem 0 0.45rem",
        color: DOC_PTEXT,
      }}>{children}</h3>
    ),
    p: ({ children }) => (
      <p style={{
        margin: "0.65rem 0",
        lineHeight: 1.65,
        color: "#c9cfd6",
        fontSize: 15,
      }}>{children}</p>
    ),
    li: ({ children }) => (
      <li style={{ margin: "0.35rem 0", color: "#c9cfd6", fontSize: 15, lineHeight: 1.55 }}>{children}</li>
    ),
    ul: ({ children }) => (
      <ul style={{ margin: "0.6rem 0", paddingLeft: 22 }}>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol style={{ margin: "0.6rem 0", paddingLeft: 22 }}>{children}</ol>
    ),
    blockquote: ({ children }) => (
      <blockquote style={{
        margin: "1rem 0",
        padding: "10px 16px",
        borderLeft: `3px solid ${DOC_PG}`,
        background: "rgba(0,255,163,0.06)",
        color: "#dde3ea",
      }}>{children}</blockquote>
    ),
    hr: () => <hr style={{ border: "none", borderTop: `1px solid ${DOC_PBORDER}`, margin: "2rem 0" }} />,
    code: ({ className, children, ...props }) => {
      const isBlock = Boolean(className?.startsWith("language-"));
      if (isBlock) {
        return (
          <code
            className={className}
            style={{
              display: "block",
              padding: "14px 16px",
              margin: "1rem 0",
              borderRadius: 10,
              background: DOC_PBG2,
              border: `1px solid ${DOC_PBORDER}`,
              fontFamily: "var(--pw-mono, ui-monospace, monospace)",
              fontSize: 13,
              overflowX: "auto",
              whiteSpace: "pre",
              color: DOC_PG,
            }}
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          style={{
            padding: "2px 6px",
            borderRadius: 6,
            background: DOC_PBG2,
            border: `1px solid ${DOC_PBORDER}`,
            fontFamily: "var(--pw-mono, ui-monospace, monospace)",
            fontSize: "0.88em",
            color: "#e8edf2",
          }}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre style={{ margin: 0, padding: 0, background: "transparent" }}>{children}</pre>
    ),
    table: ({ children }) => (
      <div style={{ overflowX: "auto", margin: "1rem 0" }}>
        <table style={{
          borderCollapse: "collapse",
          width: "100%",
          fontSize: 14,
          color: "#c9cfd6",
        }}>{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th style={{
        textAlign: "left",
        padding: "10px 12px",
        borderBottom: `1px solid ${DOC_PBORDER}`,
        color: DOC_PTEXT,
        fontWeight: 650,
      }}>{children}</th>
    ),
    td: ({ children }) => (
      <td style={{
        padding: "10px 12px",
        borderBottom: `1px solid ${DOC_PBORDER}`,
        verticalAlign: "top",
      }}>{children}</td>
    ),
  };
}

export function MarkdownReader({ markdown }: { markdown: string }) {
  return (
    <article style={{ maxWidth: 820 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents()}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
