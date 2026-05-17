# Sim-only image for Railway (see railway.toml).
FROM node:22-bookworm-slim

WORKDIR /app

# Fixes npm EBUSY rmdir on node_modules/.cache inside Docker layer caches (Railway/Nixpacks).
ENV NPM_CONFIG_CACHE=/tmp/npm-cache

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

RUN mkdir -p /tmp/npm-cache \
  && npm ci

CMD ["npm", "run", "start", "-w", "@pumpworld/sim"]
