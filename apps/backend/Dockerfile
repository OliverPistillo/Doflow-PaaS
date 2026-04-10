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

# Copy Sitebuilder assets (blocksy-companion-pro.zip) into dist
# Il TypeScript compiler non copia i file non-.ts, quindi lo facciamo manualmente
RUN mkdir -p apps/backend/dist/sitebuilder/assets \
  && cp apps/backend/src/sitebuilder/assets/blocksy-companion-pro.zip \
     apps/backend/dist/sitebuilder/assets/blocksy-companion-pro.zip 2>/dev/null || true

# ===== STAGE 2: RUNNER =====
FROM node:20-alpine AS runner
WORKDIR /app

# ── Utility Linux ─────────────────────────────────────────────────────────────
# zip    → SitebuilderController: crea lo ZIP della cartella wordpress/
# unzip  → SitebuilderProcessor v2: estrae wordpress-latest.zip e i temi
# curl   → SitebuilderProcessor v2: download WordPress e tema Blocksy
# pg_dump v17 → BackupService
RUN apk add --no-cache \
      util-linux \
      zip \
      unzip \
      curl \
  && apk add --no-cache \
      --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main \
      postgresql17-client

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

# ── FIX Sitebuilder: copia i temi zip nella cartella public/ ─────────────────
# Il builder compila solo .ts → dist/. I file statici (zip dei temi) vanno
# copiati esplicitamente dal builder al runner.
# Percorso finale nel container: /app/apps/backend/public/themes/doflow-first.zip
COPY --from=builder /app/apps/backend/public ./apps/backend/public

EXPOSE 4000

CMD ["node", "apps/backend/dist/main.js"]