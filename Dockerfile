# Sim-only image for Railway (see RAILWAY.md).
# If build logs do NOT show "=== pumpworld Dockerfile ===", Railway is still using
# Railpack — set Builder → Dockerfile and Root Directory → empty (repo root).
FROM node:22-bookworm-slim

WORKDIR /app

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# npm / tooling sometimes writes under node_modules/.cache; layered FS → EBUSY.
# Force cache + dev install phase away from production-prune paths.
ENV NPM_CONFIG_CACHE=/tmp/npm-cache

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

RUN echo "=== pumpworld Dockerfile ===" \
  && mkdir -p /tmp/npm-cache \
  && npm config set cache /tmp/npm-cache \
  && NODE_ENV=development NPM_CONFIG_PRODUCTION=false \
     npm install --no-audit --no-fund --prefer-online

CMD ["npm", "run", "start", "-w", "@pumpworld/sim"]
