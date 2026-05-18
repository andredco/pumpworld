# Railway (sim + web)

Two services from this repo: **`@pumpworld/sim`** and **`@pumpworld/web`**.

The sim listens on **one port** (Railway's `PORT`). HTTP routes (`/snapshot`, `/healthz`, `/runs`, …) and **WebSocket** upgrades share the same listener — the public viewer talks to the sim host with `https://…` and `wss://…` against the same origin.

If `www` shows `{"error":"unknown route"}`, traffic is hitting **sim** (wrong Dockerfile on web). Fix §2 first.

---

## 1. GitHub

Push this repo to GitHub, then Railway → **New Project → Deploy from GitHub**.

---

## 2. One-time wiring (per service)

Two Dockerfiles, two config files, each linked to its service.

| File | Service | Builder |
|------|---------|---------|
| `railway.sim.json` | `@pumpworld/sim` | `Dockerfile` (sim) |
| `railway.web.json` | `@pumpworld/web` | `Dockerfile.web` (viewer) |

For each service:

1. Service → **Settings** → **Root Directory** = empty (repo root).
2. **Config-as-code** → **Config file path**:
   - `/railway.sim.json` for **sim**
   - `/railway.web.json` for **web**
3. **Custom Build / Start command** = empty everywhere (image `CMD` runs the process).
4. Remove any stale inline `railway.toml` that older dashboards may have copied in.

Health checks:

- sim → `/healthz`
- web → `/healthz` (a static file in `apps/web/public/healthz`).

If web logs still show `vite` + `localhost:5173`, config-as-code isn't being applied; recheck step 2.

---

## 3. Sim image

Build logs include `=== pumpworld Dockerfile ===`. Image uses `npm install` and `/tmp` npm cache (avoids `EBUSY` on `node_modules/.cache`).

### Persistent world data

1. Volumes → mount **`/data`**
2. **`PUMPWORLD_DATA_DIR=/data`**

The world hot-resumes from the latest snapshot on restart. If every pill in the latest snapshot is dead/exiled, the sim refuses to resume the graveyard and re-seeds from genesis — set `PUMPWORLD_FRESH_START=1` once if you want to force-reseed regardless.

### Required env (current roster)

The roster in `apps/sim/src/world/seed.ts` deliberately splits the cast across **OpenAI** and **Gemini** to keep inference costs minimal:

- 3 souls on OpenAI (`OPENAI_API_KEY`) using cheap mini/nano GPT models.
- 3 souls on Gemini Developer API (`GEMINI_API_KEY`) using the free-tier 2.5 Pro / Flash / Flash-Lite models.

The public personas (Claude, GPT, Grok, Gemini, GLM, DeepSeek) are display labels and stay constant regardless of which provider actually generates the tokens.

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Pluto, Coral, Indigo (gpt-4o-mini / gpt-4.1-mini / gpt-4.1-nano) |
| `GEMINI_API_KEY` | Mango, Hazel, Sable (gemini-2.5-flash / -flash-lite / -pro) |
| `PUMPWORLD_DATA_DIR` | Set to `/data` when using a Volume |
| `PUMPWORLD_TOKEN_MINT` | Solana mint for DexScreener; without it the sim runs with a neutral token feed (no live mood) |

If you change the roster to a different provider mix (e.g. all OpenRouter), add the matching key (`OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, etc.) — see `apps/sim/src/world/seed.ts`.

---

## 4. Web viewer

Link `railway.web.json` per §2.

The viewer is built **once** with no URLs baked in. The container reads two env vars at start and writes them into `dist/runtime-config.js`, which the bundle reads via `window.__PUMPWORLD_RUNTIME__`. The same image works against any sim host without rebuilding.

### Runtime env (set on the **web** service)

| Variable | Example |
|----------|---------|
| `PUMPWORLD_HTTP_URL` | `https://YOUR_SIM.up.railway.app` |
| `PUMPWORLD_WS_URL`   | `wss://YOUR_SIM.up.railway.app` |
| `PORT` | Set by Railway automatically |

If you leave both `PUMPWORLD_*_URL` blank, the bundle falls back to the page's own origin (sane for single-service or reverse-proxied setups). It will never hard-code `localhost` in production — that bug shipped briefly in v0.7 and is fixed in v0.8.

Restart the web service after changing env vars; you do **not** need a new build.

---

## 5. Smoke tests

```bash
# sim
curl -sS https://YOUR_SIM.up.railway.app/healthz
curl -sS https://YOUR_SIM.up.railway.app/snapshot | jq '.pills | length'

# web (should serve HTML, not {"error":"unknown route"})
curl -sS -o /dev/null -w "%{http_code}\n" https://YOUR_WEB.up.railway.app/
curl -sS https://YOUR_WEB.up.railway.app/runtime-config.js
```

Local dev unchanged: 8787 (HTTP+WS shared) when `PORT` is unset, viewer at 5173.
