import { EventTicker } from "./EventTicker.js";

/**
 * Right-side event ticker. Was previously a tabbed panel with Events + Pills;
 * since the navbar has dedicated overlays for Pills (Characters) and Blogs,
 * this sidebar is now just the live event stream.
 */
export function Sidebar() {
  return (
    <div style={{
      position: "absolute",
      top: 76, right: 16, bottom: 16,
      width: 280,
      background: "var(--pw-card)",
      border: "1px solid var(--pw-border)",
      color: "var(--pw-text)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      boxShadow: "var(--pw-shadow-md)",
      borderRadius: "var(--pw-radius-md)",
    }}>
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--pw-border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{
          fontSize: 10, letterSpacing: "0.1em", color: "var(--pw-text-dim)",
          fontWeight: 700, textTransform: "uppercase",
        }}>Events</span>
        <span style={{
          width: 6, height: 6, borderRadius: 99,
          background: "var(--pw-good)",
        }} />
      </div>
      <EventTicker />
    </div>
  );
}
