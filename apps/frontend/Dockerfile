# ==========================================
# STAGE 1: BUILDER
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Abilita pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copia i file di configurazione del monorepo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copia il sorgente del frontend
COPY apps/frontend ./apps/frontend

# Installa le dipendenze
RUN pnpm install --frozen-lockfile

# Costruisci il frontend
# NOTA: Assicurati che il tuo package.json del frontend abbia lo script "build"
RUN pnpm --filter frontend run build

# ==========================================
# STAGE 2: RUNNER (Production)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Crea utente e gruppo
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 1. Copia Public e Static (come prima)
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
RUN mkdir -p apps/frontend/.next
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static

# 2. Copia la build Standalone (come prima)
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./

# 3. [FIX] Copia ANCHE i node_modules originali dalla root
#    Questo risolve l'errore "Cannot find module 'next'" sovrascrivendo le mancanze della standalone
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

# Avvia il server
CMD ["node", "apps/frontend/server.js"]