# ====== BUILDER ======
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/frontend ./apps/frontend

# Build
# Note: Next.js needs public env vars at build time
ENV NEXT_PUBLIC_API_URL=http://localhost:3000/api
RUN pnpm --filter frontend run build

# ====== RUNNER ======
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy Standalone build
# The standalone folder contains a minimal node_modules and the server.js
COPY --from=builder /app/apps/frontend/.next/standalone ./

# Copy Static Assets (Next.js needs these for images/css)
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

# Start Next.js
# Note: In standalone mode, the path mirrors your project structure
CMD ["node", "apps/frontend/server.js"]