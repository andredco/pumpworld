/**
 * Default runtime config for local dev.
 *
 * In production (Docker/Railway), serve-production.mjs OVERWRITES this file
 * inside dist/ at container start using PUMPWORLD_HTTP_URL / PUMPWORLD_WS_URL
 * from the environment. That way the same bundle works against any sim host
 * without a rebuild.
 *
 * The web client reads window.__PUMPWORLD_RUNTIME__ first; if that's missing
 * it falls back to the compile-time __PUMPWORLD_HTTP__ / __PUMPWORLD_WS__
 * baked by Vite (see vite.config.ts), which still default to localhost.
 */
window.__PUMPWORLD_RUNTIME__ = {
  httpUrl: "",
  wsUrl: "",
};
