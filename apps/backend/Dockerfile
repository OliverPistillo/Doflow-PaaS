# ===== STAGE 1: BUILD =====
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy backend source
COPY apps/backend ./apps/backend
# Copy frontend package.json just to satisfy workspace requirements
COPY apps/frontend/package.json ./apps/frontend/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build backend
RUN pnpm --filter backend run build

# Copy Lua scripts manually if needed
RUN mkdir -p apps/backend/dist/redis/scripts \
  && cp apps/backend/src/redis/scripts/dual_probe.lua apps/backend/dist/redis/scripts/dual_probe.lua || true

# ===== STAGE 2: RUNNER =====
FROM node:20-alpine AS runner
WORKDIR /app

# 🔥 FIX: Installa utility Linux necessarie per 'systeminformation'
RUN apk add --no-cache util-linux

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

EXPOSE 4000

CMD ["node", "apps/backend/dist/main.js"]