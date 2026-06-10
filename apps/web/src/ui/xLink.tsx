/**
 * Official X / Twitter handle for the project.
 *
 * One source of truth — every "follow us" affordance imports from here so
 * a future handle change is one edit, not a grep across the viewer.
 */
export const X_HANDLE = "sixsoulsfun";
export const X_URL = `https://x.com/${X_HANDLE}`;

/**
 * Minimal X glyph as inline SVG. ~12-bytes-of-render, no external requests,
 * no font loading. Currentcolor so callers can recolor with `style.color`.
 */
export function XGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        fill="currentColor"
        d="M18.244 2H21l-6.51 7.44L22 22h-6.79l-4.78-6.27L4.8 22H2.04l6.97-7.97L2 2h6.94l4.32 5.71L18.244 2zm-1.19 18h1.5L7.05 4h-1.6l11.604 16z"
      />
    </svg>
  );
}
