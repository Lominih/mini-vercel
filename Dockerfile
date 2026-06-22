# ---- Stage 1: Dependencies + Prisma ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update -y && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate

# ---- Stage 2: Build ----
FROM deps AS builder
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN rm -rf ./src/__tests__
RUN npx tsc || true

# ---- Stage 3: Production ----
FROM node:20-slim AS production
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl tini curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY prisma ./prisma

RUN mkdir -p builds deployments/sites logs && chown -R nextjs:nodejs builds deployments logs

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]