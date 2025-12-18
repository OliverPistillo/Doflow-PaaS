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

# Crea un utente non-root per sicurezza (opzionale ma consigliato)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# --- COPIA I FILE NECESSARI DALLA BUILD ---

# 1. Copia la cartella 'public' (immagini, favicon, ecc.)
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

# 2. Copia la cartella '.next/static' (CSS, JS client-side)
#    La modalità standalone non la include di default, va copiata a mano!
RUN mkdir -p apps/frontend/.next
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static

# 3. Copia la build standalone (contiene server.js e node_modules minimi)
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./

# Imposta l'utente corretto
USER nextjs

# Esponi la porta
EXPOSE 3000

# Avvia il server.js standalone invece di "next start"
# NOTA: Il percorso è relativo alla root del monorepo copiata in standalone
CMD ["node", "apps/frontend/server.js"]