import type { Pill } from "@pumpworld/protocol";

interface Props {
  pill: Pick<Pill, "shell" | "name">;
  size?: number;
  /** Show eyes & mouth on the front of the capsule. */
  withFace?: boolean;
  status?: string;
}

/**
 * SVG avatar of a pill: capsule body plus optional tiny face. Used in
 * Dialogue cards, Character cards, Blog cards, anywhere we need to identify
 * a pill outside the 3D scene.
 */
export function PillAvatar({ pill, size = 36, withFace = true, status }: Props) {
  const w = size;
  const h = Math.round(size * 1.6);
  const r = w / 2;
  const bodyH = h - r * 2;
  const muted = status === "dead" || status === "exiled";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", flexShrink: 0, opacity: muted ? 0.5 : 1 }}>
      <defs>
        <linearGradient id={`top-${pill.name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pill.shell.topColor} stopOpacity={1} />
          <stop offset="1" stopColor={pill.shell.topColor} stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id={`bot-${pill.name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pill.shell.bottomColor} stopOpacity={0.85} />
          <stop offset="1" stopColor={pill.shell.bottomColor} stopOpacity={1} />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx={w / 2} cy={h - 2} rx={r * 0.9} ry={r * 0.18} fill="rgba(0,0,0,0.35)" />
      {/* top half */}
      <path
        d={`M 0 ${r} A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${r + bodyH / 2} L 0 ${r + bodyH / 2} Z`}
        fill={`url(#top-${pill.name})`}
      />
      {/* bottom half */}
      <path
        d={`M 0 ${r + bodyH / 2} L ${w} ${r + bodyH / 2} L ${w} ${h - r} A ${r} ${r} 0 0 1 0 ${h - r} Z`}
        fill={`url(#bot-${pill.name})`}
      />
      {/* band */}
      <rect x={0} y={r + bodyH / 2 - 1} width={w} height={2} fill={pill.shell.bandColor} opacity={0.85} />
      {/* highlight */}
      <ellipse cx={w * 0.32} cy={r * 0.95} rx={r * 0.18} ry={r * 0.5} fill="white" opacity={0.18} />

      {withFace && !muted && (
        <>
          {/* eyes */}
          <circle cx={w * 0.36} cy={r + bodyH * 0.15} r={Math.max(1.5, w * 0.05)} fill="#0d0d12" />
          <circle cx={w * 0.64} cy={r + bodyH * 0.15} r={Math.max(1.5, w * 0.05)} fill="#0d0d12" />
          {/* mouth */}
          <rect
            x={w * 0.4} y={r + bodyH * 0.4}
            width={w * 0.2} height={1.5}
            fill="#3a1818" rx={0.5}
          />
        </>
      )}
    </svg>
  );
}
