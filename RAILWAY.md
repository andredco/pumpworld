# Railway (sim + web)

The simulator listens on **one port**: Railway’s **`PORT`**. HTTP routes (`/snapshot`, `/healthz`, …) and **WebSocket** upgrades share it (same URL as API, `wss://…`).

Use **two Railway services** from this repo: **`@pumpworld/sim`** and **`@pumpworld/web`**.

If **`www`** shows **`{"error":"unknown route"}`**, traffic is hitting **sim** (wrong Dockerfile on web). Fix **§2** first.

---

## 1. GitHub

Push this repo to GitHub, then in Railway: **New Project → Deploy from GitHub → pick the repo**.

---

## 2. One-time wiring (do this once per service)

Railway only auto-loads config from a root **`railway.toml`** / **`railway.json`**. Two Dockerfiles need **two config files**, each **linked** to its service.

Repo files:

| File | Service |
|------|---------|
| **`railway.sim.json`** | **`@pumpworld/sim`** |
| **`railway.web.json`** | **`@pumpworld/web`** |

### Steps (repeat for **sim** and **web**)

1. Open the service → **Settings**.
2. **Root Directory** → **empty** (repo root). **`Dockerfile.web` requires root context** (`package.json`, `packages/`, `apps/web/`).
3. **Config-as-code** → set **Config file path** (wording varies) to:
   - **`/railway.sim.json`** on **sim**
   - **`/railway.web.json`** on **web**  
   Use a **leading slash**, path from repo root.
4. Remove **any inline / pasted `railway.toml`** in Railway (old UI copies can override Git and keep showing “set in railway.toml”).
5. **Deploy** tab: **Custom Start Command** → **empty** everywhere (image **`CMD`** runs the process).

After linking **`railway.sim.json`** / **`railway.web.json`**, Railway merges **build + deploy** from that file (config overrides auto-detected Vite **`dev`** for web).

| File | Builder | Notes |
|------|---------|--------|
| **`railway.sim.json`** | **Dockerfile** (`Dockerfile`) | **`startCommand`**: image **`CMD`** |
| **`railway.web.json`** | **Railpack** | Explicit **`npm ci --include=dev`** → **`build`** → **`npm run start -w @pumpworld/web`** (**`vite preview`** on **`PORT`**) |

5. **Deploy** tab: **Custom Start Command** → **empty** on **both** (config-as-code supplies commands). Clear any **`npm run dev`** overrides left over from the template.

### Optional: Docker image for web instead

Use **`Dockerfile.web`** by replacing **`railway.web.json`** **`build`** section with **`builder: DOCKERFILE`**, **`dockerfilePath: Dockerfile.web`**, **`buildCommand: null`**, **`deploy.startCommand: null`** — or keep the committed **`railway.web.json`** Railpack flow above.

### Fallback (sim Dockerfile env var)

On **`@pumpworld/web`** only: **`RAILWAY_DOCKERFILE_PATH`** = **`Dockerfile.web`** only helps **Docker** builds; it does not fix Railpack **`dev`** by itself.

### If **`@pumpworld/web`** deploy logs still show **`vite`** + **`localhost:5173`**

The service is **not** loading **`/railway.web.json`** (wrong config path, inline **`railway.toml`** in the dashboard, or dashboard **Custom Start Command** still set to **`dev`**). Fix **§2**, redeploy, and confirm the deployment details page shows settings sourced from **`railway.web.json`**.

## 3. Sim image

Build logs must include **`=== pumpworld Dockerfile ===`**. Image uses **`npm install`** and **`/tmp`** npm cache to reduce **`EBUSY`** on **`node_modules/.cache`**.

### Persistent world data

1. **Volumes** → mount **`/data`**
2. **`PUMPWORLD_DATA_DIR=/data`**

### Env (default roster)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Five pills (`openai` in roster) |
| `GEMINI_API_KEY` | Mango (`gemini`); or `GOOGLE_AI_API_KEY`, etc. |
| `PUMPWORLD_DATA_DIR` | e.g. `/data` with a volume |

Optional: `PUMPWORLD_TOKEN_MINT`; on Railway without mint, sim uses a **neutral token feed**. Other keys if you change roster — see `apps/sim/src/world/seed.ts`.

---

## 4. Web viewer

Link **`railway.web.json`** (§2).

**Build-time** vars (Vite bakes URLs at build):

| Variable | Example |
|----------|---------|
| `PUMPWORLD_HTTP_URL` | `https://YOUR_SIM.up.railway.app` |
| `PUMPWORLD_WS_URL` | `wss://YOUR_SIM.up.railway.app` |

Point both at the **sim** public host. Redeploy **web** after changing them.

---

## 5. Smoke tests

```bash
curl -sS https://YOUR_SIM.up.railway.app/healthz
```

Custom domain for **web** should return **HTML** at **`/`**, not **`{"error":"unknown route"}`**.

Local dev unchanged: **8787** + **8788** when **`PORT`** is unset.
