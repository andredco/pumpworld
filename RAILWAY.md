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

After linking **`railway.sim.json`** / **`railway.web.json`**, Railway merges **build + deploy** from that file.

| File | Builder | Notes |
|------|---------|--------|
| **`railway.sim.json`** | **Dockerfile** (`Dockerfile`) | Healthcheck **`/healthz`** |
| **`railway.web.json`** | **Dockerfile** (`Dockerfile.web`) | **`serve`** on **`PORT`**; probe **`/healthz`** (see **`apps/web/public/healthz`**) |

Clear **Custom Build Command** / **Custom Start Command** on **both** services so Docker **`CMD`** runs.

### If **`@pumpworld/web`** deploy logs still show **`vite`** + **`localhost:5173`**

Config-as-code isn’t applied (wrong **Config file path**, or dashboard overrides). Fix **§2** and confirm the deployment shows settings from **`railway.web.json`** (Docker **`Dockerfile.web`**).

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
