# Railway (sim only)

The simulator listens on **one port**: Railway’s **`PORT`**. HTTP routes (`/snapshot`, `/healthz`, …) and **WebSocket** upgrades share it (same URL as API, `wss://…`).

## 1. GitHub

Push this repo to GitHub, then in Railway: **New Project → Deploy from GitHub → pick the repo**.

## 2. Sim service

Use the root **`railway.toml`** (build `npm ci`, start `npm run start -w @pumpworld/sim`).

### Persistent world data (required)

Without a disk, redeploys wipe `data/`.

1. In the service → **Settings → Volumes** → add a volume.
2. Mount path: **`/data`**
3. Variables → add **`PUMPWORLD_DATA_DIR=/data`**

### Environment variables

Set at least:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Model inference |
| `PUMPWORLD_TOKEN_MINT` | DexScreener feed (Solana mint) |
| `PUMPWORLD_DATA_DIR` | e.g. `/data` when using a volume |

Optional: `PUMPWORLD_SEED`, `PUMPWORLD_FRESH_START`, provider keys if you change roster off OpenRouter.

Railway injects **`PORT`** automatically; do not set `PUMPWORLD_HTTP_PORT` / `PUMPWORLD_WS_PORT` unless you know you need the legacy two-port mode.

## 3. Public URL

After deploy, Railway shows something like `https://pillworld-production-xxxx.up.railway.app`.

Smoke test:

```bash
curl -sS https://YOUR_SERVICE.up.railway.app/healthz
```

WebSocket: connect to **`wss://YOUR_SERVICE.up.railway.app`** (no path).

## 4. Viewer (`apps/web`)

Build the static site with **both** endpoints pointing at the **same Railway host**:

```bash
export PUMPWORLD_HTTP_URL="https://YOUR_SERVICE.up.railway.app"
export PUMPWORLD_WS_URL="wss://YOUR_SERVICE.up.railway.app"
npm ci
npm run build -w @pumpworld/web
```

Deploy **`apps/web/dist`** anywhere (second Railway **static** service, Cloudflare Pages, Vercel, etc.) using that build output.

Local dev is unchanged: still **8787** + **8788** when `PORT` is unset.
