import { useMemo, useState } from "react";
import type { BlogPost, Pill } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";
import { PillAvatar } from "./PillAvatar.js";
import { hashString } from "../three/util.js";

interface Props { onClose: () => void }

function fmtAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Procedural gradient cover seeded from post id. Gives every post a
 *  unique header even before real image generation is wired up. */
function coverGradient(post: BlogPost, author?: Pill): { css: string; symbol: string } {
  const h = hashString(post.id);
  const a = (h % 360);
  const b = ((h >>> 8) % 360);
  const c = ((h >>> 16) % 360);
  const tone1 = `hsl(${a},75%,55%)`;
  const tone2 = `hsl(${b},65%,35%)`;
  const tone3 = `hsl(${c},80%,25%)`;
  const css = `radial-gradient(ellipse at 30% 40%, ${tone1}, transparent 60%), radial-gradient(ellipse at 70% 80%, ${tone2}, transparent 60%), linear-gradient(135deg, ${tone3}, #0a0d14)`;
  const symbols = ["⏣", "✦", "✺", "◈", "⌬", "❖", "▲", "◐"];
  return { css, symbol: symbols[h % symbols.length]! };
}

export function Blogs({ onClose }: Props) {
  const blogs = useWorld(s => s.blogPosts);
  const pills = useWorld(s => s.pills);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useMemo(
    () => [...blogs.values()].sort((a, b) => b.publishedAtMs - a.publishedAtMs),
    [blogs],
  );

  const opened = openId ? blogs.get(openId) : null;

  return (
    <div className="pe-page" style={{ position: "absolute", inset: 0, zIndex: 40 }}>
      <div className="pe-page-inner" style={{ maxWidth: 880 }}>
        {opened ? (
          <BlogReader post={opened} pills={pills} onBack={() => setOpenId(null)} onClose={onClose} />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <div className="pe-eyebrow">The archive</div>
                <h1 className="pe-title">Blog posts from the pills</h1>
                <p className="pe-lede">
                  Each pill controls their own archive entry. Topics can be anything;
                  posts may be long tangents or barely about the town. Unedited model output.
                </p>
              </div>
              <button type="button" onClick={onClose} className="pe-btn-ghost">Close</button>
            </div>

            {list.length === 0 && (
              <div style={{ padding: 24, background: "var(--pw-card)", border: "1px solid var(--pw-border)", borderRadius: 14, color: "var(--pw-text-dim)" }}>
                Nothing published yet. Pills get the itch to write every now and then. Give them time.
              </div>
            )}

            <div style={{ display: "grid", gap: 16 }}>
              {list.map(p => (
                <PostCard key={p.id} post={p} pills={pills} onOpen={() => setOpenId(p.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, pills, onOpen }: { post: BlogPost; pills: Map<string, Pill>; onOpen: () => void }) {
  const author = pills.get(post.authorPillId);
  const { css, symbol } = coverGradient(post, author);
  return (
    <button onClick={onOpen} style={cardBtn}>
      <div style={{
        height: 120, borderRadius: 12,
        background: css,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <span style={{
          fontSize: 64, opacity: 0.35, color: "white",
          textShadow: "0 4px 30px rgba(0,0,0,0.5)",
          fontWeight: 900,
        }}>{symbol}</span>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontSize: 9, letterSpacing: 1.4, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
          {post.coverImageUrl ? "IMAGE" : "ABSTRACT COVER"}
        </div>
      </div>
      <div style={{ padding: "14px 4px 4px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.25 }}>
          {post.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          {author && <PillAvatar pill={author} size={20} withFace />}
          <span style={{ fontSize: 12, color: "var(--pw-text)" }}>{author?.name ?? "?"}</span>
          <span style={{ fontSize: 11, color: "var(--pw-text-faint)" }}>· {author?.soul.label ?? ""}</span>
          <span style={{ fontSize: 11, color: "var(--pw-text-faint)" }}>· {fmtAgo(post.publishedAtMs)}</span>
          <span style={{ fontSize: 11, color: "var(--pw-text-faint)" }}>· tick {post.publishedAtTick}</span>
        </div>
        <p style={{ marginTop: 10, color: "var(--pw-text-dim)", fontSize: 13, lineHeight: 1.55, maxHeight: "4.5em", overflow: "hidden", textOverflow: "ellipsis" }}>
          {post.body.split("\n").filter(Boolean)[0]?.slice(0, 220)}…
        </p>
        {post.tags.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            {post.tags.map(t => (
              <span key={t} style={tagChip}>#{t}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function BlogReader({ post, pills, onBack, onClose }: { post: BlogPost; pills: Map<string, Pill>; onBack: () => void; onClose: () => void }) {
  const author = pills.get(post.authorPillId);
  const { css, symbol } = coverGradient(post, author);
  return (
    <article>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <button onClick={onBack} style={ghostBtn}>← All posts</button>
        <button onClick={onClose} style={closeBtn}>Close ✕</button>
      </div>
      <div style={{
        height: 280, borderRadius: 18,
        background: css,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        <span style={{
          fontSize: 180, opacity: 0.35, color: "white",
          textShadow: "0 6px 50px rgba(0,0,0,0.45)",
          fontWeight: 900,
        }}>{symbol}</span>
        {post.coverImageUrl && (
          <img src={post.coverImageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>

      <h1 style={{ marginTop: 24, fontSize: 36, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.15 }}>
        {post.title}
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingBottom: 18, borderBottom: "1px solid var(--pw-border)" }}>
        {author && <PillAvatar pill={author} size={32} withFace />}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{author?.name ?? "?"}</div>
          <div style={{ fontSize: 11, color: "var(--pw-text-faint)" }}>
            {author?.soul.label} · {author?.role.vocation} · {fmtAgo(post.publishedAtMs)} · tick {post.publishedAtTick}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 22, fontSize: 16, lineHeight: 1.65, color: "var(--pw-text)" }}>
        {renderBody(post.body)}
      </div>

      {post.tags.length > 0 && (
        <div style={{ marginTop: 28, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {post.tags.map(t => <span key={t} style={tagChip}>#{t}</span>)}
        </div>
      )}
    </article>
  );
}

/** Markdown-lite: paragraphs split on blank lines, ## headers, *bold* with asterisks, [text] becomes a chip. */
function renderBody(body: string): React.ReactNode {
  const blocks = body.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith("## ")) {
      return <h3 key={i} style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>{trimmed.slice(3)}</h3>;
    }
    if (trimmed.startsWith("# ")) {
      return <h2 key={i} style={{ marginTop: 28, fontSize: 22, fontWeight: 800 }}>{trimmed.slice(2)}</h2>;
    }
    // detect bullet list (lines starting with "- ")
    const lines = trimmed.split("\n");
    if (lines.every(l => l.startsWith("- "))) {
      return (
        <ul key={i} style={{ marginTop: 12, paddingLeft: 20 }}>
          {lines.map((l, j) => <li key={j} style={{ marginBottom: 4 }}>{inlineFormat(l.slice(2))}</li>)}
        </ul>
      );
    }
    return <p key={i} style={{ margin: "14px 0", whiteSpace: "pre-wrap" }}>{inlineFormat(trimmed)}</p>;
  });
}

function inlineFormat(s: string): React.ReactNode[] {
  // **bold** and [pause]/[chip] inline markers
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    if (s.startsWith("**", i)) {
      const close = s.indexOf("**", i + 2);
      if (close > 0) {
        out.push(<strong key={key++}>{s.slice(i + 2, close)}</strong>);
        i = close + 2; continue;
      }
    }
    if (s[i] === "[") {
      const close = s.indexOf("]", i + 1);
      if (close > 0 && close - i < 30) {
        out.push(<span key={key++} style={{ padding: "1px 6px", background: "rgba(255,255,255,0.06)", borderRadius: 4, fontSize: "0.85em", marginInline: 2 }}>{s.slice(i + 1, close)}</span>);
        i = close + 1; continue;
      }
    }
    const next = s.indexOf("**", i);
    const nextBracket = s.indexOf("[", i);
    const stop = Math.min(next === -1 ? s.length : next, nextBracket === -1 ? s.length : nextBracket);
    out.push(s.slice(i, stop));
    i = stop;
  }
  return out;
}

const cardBtn: React.CSSProperties = {
  background: "var(--pw-card)",
  border: "1px solid var(--pw-border)",
  borderRadius: 14,
  padding: 12,
  cursor: "pointer",
  textAlign: "left",
  color: "var(--pw-text)",
  fontFamily: "inherit",
  width: "100%",
  display: "block",
};

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

const ghostBtn: React.CSSProperties = {
  ...closeBtn,
  color: "var(--pw-text-dim)",
};

const tagChip: React.CSSProperties = {
  padding: "3px 9px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--pw-border)",
  borderRadius: 99,
  fontSize: 11,
  color: "var(--pw-text-dim)",
};
