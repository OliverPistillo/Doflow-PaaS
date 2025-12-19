# ====== BUILDER ======
FROM node:20-alpine AS builder
WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# workspace (cache)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json

# install deps
RUN pnpm install --frozen-lockfile

# copy frontend
COPY apps/frontend ./apps/frontend

# build
RUN pnpm --filter frontend run build


# ====== RUNNER ======
FROM node:20-alpine AS runner
ENV NODE_ENV=production

# Copio tutto lo standalone (che contiene /apps/frontend/server.js nel caso monorepo)
WORKDIR /app
COPY --from=builder /app/apps/frontend/.next/standalone ./

# Static + public: nel runtime devono stare sotto /app/apps/frontend/...
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

# Avvio dalla cartella corretta
WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["node", "server.js"]
