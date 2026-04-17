# ===== STAGE 1: BUILD =====
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/backend ./apps/backend
COPY apps/frontend/package.json ./apps/frontend/package.json

RUN pnpm install --frozen-lockfile

RUN pnpm --filter backend run build

# Copia script Lua (non copiati da tsc)
RUN mkdir -p apps/backend/dist/redis/scripts \
  && cp apps/backend/src/redis/scripts/dual_probe.lua \
     apps/backend/dist/redis/scripts/dual_probe.lua || true

# ===== STAGE 2: RUNNER =====
FROM node:20-alpine AS runner
WORKDIR /app

# pg_dump → BackupService
# curl → health checks / webhook outbound
RUN apk add --no-cache \
      curl \
  && apk add --no-cache \
      --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main \
      postgresql17-client

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

EXPOSE 4000
CMD ["node", "apps/backend/dist/main.js"]