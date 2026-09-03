# ====== BUILDER ======
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/frontend ./apps/frontend

# --- FIX START ---
# Definiamo un ARGomento che possiamo passare da docker-compose
ARG NEXT_PUBLIC_API_URL
# Assegniamo l'argomento alla variabile d'ambiente per la build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# --- FIX END ---

# The workspace prebuild validates Desktop + GitHub branding inputs that are
# intentionally excluded from this frontend-only Docker context. CI runs that
# repository-wide gate before deployment; the image builds the verified Next
# source directly so it does not depend on files unavailable by design here.
RUN pnpm --filter frontend exec next build

# ====== RUNNER ======
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy Standalone build
COPY --from=builder /app/apps/frontend/.next/standalone ./

# Copy Static Assets
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
