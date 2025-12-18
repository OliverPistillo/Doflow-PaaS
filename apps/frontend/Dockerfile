# ====== BUILDER ======
FROM node:20-alpine AS builder
WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Copia file workspace prima (cache)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json

# Installa deps (workspace)
RUN pnpm install --frozen-lockfile

# Copia il resto del frontend
COPY apps/frontend ./apps/frontend

# Build Next (standalone)
RUN pnpm --filter frontend run build


# ====== RUNNER ======
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copia standalone output
# Dentro .next/standalone c'è server.js + node_modules necessari
COPY --from=builder /app/apps/frontend/.next/standalone ./
# Static e public separati
COPY --from=builder /app/apps/frontend/.next/static ./.next/static
COPY --from=builder /app/apps/frontend/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
