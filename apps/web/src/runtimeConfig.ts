/**
 * Resolves the live sim URL the viewer should connect to.
 *
 * Priority:
 *   1. `window.__PUMPWORLD_RUNTIME__` — written into `/runtime-config.js`
 *      by the production server at container start. This is how Railway /
 *      Docker deploys point the same prebuilt bundle at a different sim host
 *      without rebuilding.
 *   2. `__PUMPWORLD_HTTP__` / `__PUMPWORLD_WS__` — Vite-baked compile-time
 *      defaults (see vite.config.ts). Set via env vars at build time. Used
 *      for local dev (`http://localhost:8787`) and as a build-time fallback.
 *   3. `window.location` — last resort. If the page is served from the same
 *      origin as the sim (the common Railway single-service shape), HTTP and
 *      WS both speak to that origin with the right scheme. We never want to
 *      ship a bundle that hardcodes "localhost" for a public viewer.
 *
 * Mixed-content note: a page on `https://` cannot open `ws://` or `http://`
 * to a different origin. We coerce schemes accordingly so a misconfigured
 * deploy degrades to "talking to itself" rather than silently failing.
 */

declare global {
  interface Window {
    __PUMPWORLD_RUNTIME__?: { httpUrl?: string; wsUrl?: string };
  }
}

interface PwUrls {
  httpUrl: string;
  wsUrl: string;
}

function trim(u: string | undefined): string {
  if (!u) return "";
  return u.trim().replace(/\/$/, "");
}

function isLocalhost(u: string): boolean {
  return /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(u);
}

function deriveFromOrigin(): PwUrls {
  if (typeof window === "undefined") return { httpUrl: "", wsUrl: "" };
  const { protocol, host } = window.location;
  const httpUrl = `${protocol}//${host}`;
  const wsUrl = `${protocol === "https:" ? "wss:" : "ws:"}//${host}`;
  return { httpUrl, wsUrl };
}

function pickUrls(): PwUrls {
  const runtime = typeof window !== "undefined" ? window.__PUMPWORLD_RUNTIME__ : undefined;
  const runtimeHttp = trim(runtime?.httpUrl);
  const runtimeWs = trim(runtime?.wsUrl);

  const compileHttp = trim(typeof __PUMPWORLD_HTTP__ !== "undefined" ? __PUMPWORLD_HTTP__ : "");
  const compileWs = trim(typeof __PUMPWORLD_WS__ !== "undefined" ? __PUMPWORLD_WS__ : "");

  // 1. Runtime config wins outright if both are present.
  if (runtimeHttp && runtimeWs) {
    return { httpUrl: runtimeHttp, wsUrl: runtimeWs };
  }

  // 2. If we're in the browser on a non-localhost origin and the only thing
  //    we have is a localhost compile-time default (or nothing), assume the
  //    sim is co-located and use the page's own origin. This is the right
  //    default for Railway single-service deploys and unmistakably better
  //    than shipping "ws://localhost:8788" to the public.
  if (typeof window !== "undefined") {
    const origin = deriveFromOrigin();
    const onLocalPage = isLocalhost(origin.httpUrl);
    const compileLooksLocal = !compileHttp || isLocalhost(compileHttp);
    if (!onLocalPage && compileLooksLocal && !runtimeHttp && !runtimeWs) {
      return origin;
    }
  }

  // 3. Mix runtime + compile-time, runtime wins per-field.
  const httpUrl = runtimeHttp || compileHttp || (typeof window !== "undefined" ? deriveFromOrigin().httpUrl : "");
  const wsUrl = runtimeWs || compileWs || (typeof window !== "undefined" ? deriveFromOrigin().wsUrl : "");
  return { httpUrl, wsUrl };
}

const RESOLVED = pickUrls();

/** Base HTTP origin for the sim (no trailing slash). e.g. `https://sim.up.railway.app`. */
export const HTTP_BASE: string = RESOLVED.httpUrl;
/** WebSocket origin for the sim. e.g. `wss://sim.up.railway.app`. */
export const WS_BASE: string = RESOLVED.wsUrl;
