# ====== BUILDER ======
FROM node:20-alpine AS builder
WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# workspace (cache)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/frontend/package.json ./apps/frontend/package.json

# install deps
RUN pnpm install --frozen-lockfile

# copy frontend
COPY apps/frontend ./apps/frontend

# build
RUN pnpm --filter frontend run build


# ====== RUNNER ======
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Standalone (contiene /apps/frontend/server.js nel tuo monorepo)
COPY --from=builder /app/apps/frontend/.next/standalone ./

# Static + public (Next si aspetta questi path)
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
CMD ["node", "/app/apps/frontend/server.js"]
