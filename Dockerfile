# ---- Stage 1: Dependencies + Prisma ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
RUN npx prisma download

# ---- Stage 2: Build ----
FROM deps AS builder
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN rm -rf ./src/__tests__
RUN npx tsc || true

# ---- Stage 3: Production ----
FROM node:20-alpine AS production
ENV NODE_ENV=production

RUN apk add --no-cache tini curl openssl

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY prisma ./prisma

RUN mkdir -p builds deployments/sites logs && chown -R appuser:appgroup builds deployments logs

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]