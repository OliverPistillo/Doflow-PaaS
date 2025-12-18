# ==========================================
# STAGE 1: BUILDER
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Attiva pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copia tutto il monorepo (così abbiamo lockfile e tutto aggiornato)
COPY . .

# Installa tutte le dipendenze
RUN pnpm install --frozen-lockfile

# Costruisci il frontend
RUN pnpm --filter frontend run build

# --- PASSAGGIO CHIAVE ---
# Usa "pnpm deploy" per creare una cartella pronta per la produzione.
# Questo risolve il problema dei symlink e dei moduli mancanti.
# Crea una cartella /prod/frontend con package.json e node_modules "reali".
RUN pnpm --filter frontend deploy --prod /prod/frontend

# Copia manualmente la build di Next.js (.next) dentro la cartella di deploy
# (pnpm deploy copia solo dipendenze e sorgenti, non la build)
COPY apps/frontend/.next /prod/frontend/.next
COPY apps/frontend/public /prod/frontend/public

# ==========================================
# STAGE 2: RUNNER
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Crea utente
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia la cartella "perfetta" preparata nello stage builder
COPY --from=builder --chown=nextjs:nodejs /prod/frontend ./

USER nextjs

EXPOSE 3000

# Avvia usando npm start (che esegue "next start" definito nel package.json)
# Questo è molto più robusto di "node server.js"
CMD ["npm", "start"]