# ===== STAGE 1: BUILD =====
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Monorepo config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Sorgente frontend
COPY apps/frontend ./apps/frontend

# Install di tutto il monorepo
RUN pnpm install

# Build solo frontend
RUN pnpm --filter frontend run build

# ===== STAGE 2: RUNNER =====
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copia TUTTO l'ambiente buildato
COPY --from=builder /app ./

WORKDIR /app/apps/frontend
EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
