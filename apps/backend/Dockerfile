# ===== STAGE 1: BUILD =====
FROM node:18-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Monorepo config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Sorgente backend
COPY apps/backend ./apps/backend

# Install di tutto il monorepo (node_modules in /app)
RUN pnpm install

# Build solo backend
RUN pnpm --filter backend run build

# COPIA lo script Lua anche dentro la cartella dist
RUN mkdir -p apps/backend/dist/redis/scripts \
  && cp apps/backend/src/redis/scripts/dual_probe.lua apps/backend/dist/redis/scripts/dual_probe.lua

# ===== STAGE 2: RUNNER =====
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copia TUTTO l'ambiente buildato
COPY --from=builder /app ./

EXPOSE 4000

# Avvia Nest dal path giusto
CMD ["node", "apps/backend/dist/main.js"]
