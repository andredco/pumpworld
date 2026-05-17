# Railway (sim + optional web)

The simulator listens on **one port**: Railway’s **`PORT`**. HTTP routes (`/snapshot`, `/healthz`, …) and **WebSocket** upgrades share it (same URL as API, `wss://…`).

Use **two Railway services** from this repo: **`@pumpworld/sim`** (API) and **`@pumpworld/web`** (static viewer). If **`www`** shows `{"error":"unknown route"}`, the **sim** is answering — wrong Dockerfile or start command on **web**. This repo **does not ship `railway.toml`** so Railway won’t lock build settings; configure **each service in the dashboard** (below).

## 1. GitHub

Push this repo to GitHub, then in Railway: **New Project → Deploy from GitHub → pick the repo**.

## 2. Two services (dashboard only — no `railway.toml`)

A root **`railway.toml`** forces **config-as-code**: Railway greys out Dockerfile settings and shows **“value is set in railway.toml”**. For **two different Dockerfiles** (sim vs web), **omit `railway.toml`** and set everything per service below.

In Railway → **each** service → **Settings → Build**:

| Service | Dockerfile path | Custom Build Command |
|---------|-----------------|----------------------|
| **`@pumpworld/sim`** | **`Dockerfile`** | *(empty)* |
| **`@pumpworld/web`** | **`Dockerfile.web`** | *(empty)* |

**Deploy:** leave **Custom Start Command** empty on both (image **`CMD`**).

**Healthcheck:** **`@pumpworld/sim`** → **`/healthz`** · **`@pumpworld/web`** → **`/`**

Never run **`npm run build --workspace=@pumpworld/web`** as the web **Custom Build Command** — **`Dockerfile.web`** already builds inside Docker.

### Sim service — image details

The sim Docker build prints **`=== pumpworld Dockerfile ===`** and uses **`npm install`** with cache under **`/tmp`** to avoid **`EBUSY`** on **`node_modules/.cache`**.

### If builds still show only `RUN npm ci` (Railpack)

Railway is **not** using your Dockerfile.

1. Service → **Settings → Build**.
2. **Root Directory** → leave **empty** (repo root).
3. **Builder** → **Dockerfile** (not Railpack).
4. **Dockerfile path** → **`Dockerfile`** (sim) or **`Dockerfile.web`** (web). If this field was greyed out, remove **`railway.toml`** from the repo (or delete **`[build]`** from it) and redeploy.
5. **Custom Build Command** → empty.

Redeploy sim and confirm logs contain **`=== pumpworld Dockerfile ===`** (web should show **`=== pumpworld Dockerfile.web ===`**).

### Persistent world data (required)

Without a disk, redeploys wipe `data/`.

1. In the service → **Settings → Volumes** → add a volume.
2. Mount path: **`/data`**
3. Variables → add **`PUMPWORLD_DATA_DIR=/data`**

### Environment variables

The **default six-pill roster** (`apps/sim/src/world/seed.ts`) uses **OpenAI Chat Completions for five pills** and **Gemini for one** (Mango). Set at least:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Five pills (`openai` provider in roster) |
| `GEMINI_API_KEY` | Mango (`gemini` provider); alternately `gemini_api_key`, `GOOGLE_AI_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY` |
| `PUMPWORLD_DATA_DIR` | e.g. `/data` when using a volume |

Optional:

| Variable | Purpose |
|----------|---------|
| `PUMPWORLD_TOKEN_MINT` | DexScreener live stats (Solana mint). On Railway, if unset, the sim uses a **neutral token feed** so the service can still boot. |
| `OPENROUTER_API_KEY` | Only if you change souls to `provider: openrouter` |

Other optional: `PUMPWORLD_SEED`, `PUMPWORLD_FRESH_START`, keys for Anthropic / xAI / MiniMax / OSS if you edit the roster.

### Healthcheck failure (`Network > Healthcheck`)

Railway expects **`GET /healthz`** on **`PORT`** → **200**. Messages like **“service unavailable”** usually mean the **container exited** or never listened.

1. **Deploy logs** — Open the **Deploy** log stream (not only the healthcheck panel). Look for `Error:` such as **`OPENAI_API_KEY is required`** or **`GEMINI_API_KEY … is required`**. Setting only **`OPENROUTER_API_KEY`** is **not** enough for the default roster.
2. **Wrong interface** — With **`PORT`** set (Railway), the sim binds **`0.0.0.0`** so the platform can reach the container.
3. **Neutral token feed on Railway** — If **`PUMPWORLD_TOKEN_MINT`** is unset **and** Railway env is detected, the sim still boots without DexScreener; add the mint when you want live market stats.

Railway injects **`PORT`** automatically; do not set `PUMPWORLD_HTTP_PORT` / `PUMPWORLD_WS_PORT` unless you know you need the legacy two-port mode.

## 3. Public URL

After deploy, Railway shows something like `https://pillworld-production-xxxx.up.railway.app`.

Smoke test:

```bash
curl -sS https://YOUR_SERVICE.up.railway.app/healthz
```

WebSocket: connect to **`wss://YOUR_SERVICE.up.railway.app`** (no path).

## 4. Viewer service (`@pumpworld/web` on Railway)

### Dockerfile (recommended)

1. New service from the same repo → **Settings → Build**.
2. **Dockerfile path**: **`Dockerfile.web`** (not `Dockerfile`).
3. **Clear** any **Custom Start Command** so the image **`CMD`** (`serve …`) runs.
4. **Healthcheck**: use **`/`** (not **`/healthz`** — that’s only for **sim**).

### Build-time variables (required for a working viewer)

Vite bakes API URLs at **`npm run build`**. In Railway → **web** service → **Variables**, add as **build-time** / Docker **ARG** (Railway: link variables to **Build**):

| Variable | Example |
|----------|---------|
| `PUMPWORLD_HTTP_URL` | `https://YOUR_SIM_HOST.up.railway.app` |
| `PUMPWORLD_WS_URL` | `wss://YOUR_SIM_HOST.up.railway.app` |

Use your **sim** public HTTPS URL for both (same host as WebSocket).

Redeploy **web** after changing these.

### Local build (alternative hosts)

```bash
export PUMPWORLD_HTTP_URL="https://YOUR_SIM_HOST.up.railway.app"
export PUMPWORLD_WS_URL="wss://YOUR_SIM_HOST.up.railway.app"
npm ci
npm run build -w @pumpworld/web
```

Deploy **`apps/web/dist`** anywhere, or use **`Dockerfile.web`** on Railway.

Local dev is unchanged: **8787** + **8788** when `PORT` is unset.
