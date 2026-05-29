/**
 * JS-accessible palette for inline styles (landing, charts).
 * Prefer CSS variables (`var(--pw-*)`) in viewer chrome when possible.
 */
export const T = {
  accent: "#a78bfa",
  accentStrong: "#8b5cf6",
  accentSoft: "rgba(167, 139, 250, 0.12)",
  accentLine: "rgba(167, 139, 250, 0.32)",
  accentGradient: "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #8b5cf6 100%)",
  textGradient: "linear-gradient(110deg, #e9d5ff 0%, #c4b5fd 45%, #a78bfa 100%)",

  danger: "#f87171",
  dangerSoft: "rgba(248, 113, 113, 0.12)",

  bg: "#060608",
  bg2: "#0b0b0e",
  bgElevated: "#111114",

  text: "#f4f4f5",
  textSecondary: "#a1a1aa",
  textMuted: "#52525b",

  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",

  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
} as const;
