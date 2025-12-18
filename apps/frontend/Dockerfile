# ==========================================
# STAGE 1: BUILDER
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Attiva pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copia i file di configurazione del monorepo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copia il sorgente del frontend
COPY apps/frontend ./apps/frontend

# Installa tutte le dipendenze (incluse quelle di sviluppo per la build)
RUN pnpm install --frozen-lockfile

# Costruisci il frontend
RUN pnpm --filter frontend run build

# --- PASSAGGIO RISOLUTIVO ---
# "pnpm deploy" crea una cartella isolata con dependencies REALI (no symlink)
# e un package.json pronto per la produzione.
RUN pnpm --filter frontend deploy --prod /prod/frontend

# Copia manualmente la build di Next.js (.next) e la cartella public
# dentro la cartella di deploy (pnpm deploy copia solo le dipendenze)
COPY apps/frontend/.next /prod/frontend/.next
COPY apps/frontend/public /prod/frontend/public

# ==========================================
# STAGE 2: RUNNER
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Crea utente di sistema
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia la cartella "deployata" dallo stage builder
# Questa cartella ora contiene TUTTO: node_modules reali, .next e package.json
COPY --from=builder --chown=nextjs:nodejs /prod/frontend ./

USER nextjs

EXPOSE 3000

# Avvia usando il comando standard di Next.js
# Questo leggerà il package.json copiato ed eseguirà "next start"
CMD ["npm", "start"]