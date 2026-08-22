FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# --- Dependencies stage ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/ai/package.json ./packages/ai/
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace=apps/api

# --- Build stage ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/ai/node_modules ./packages/ai/node_modules

COPY tsconfig.json ./
COPY turbo.json ./
COPY package.json package-lock.json ./
COPY packages/types/ ./packages/types/
COPY packages/database/ ./packages/database/
COPY packages/auth/ ./packages/auth/
COPY packages/ai/ ./packages/ai/
COPY apps/api/ ./apps/api/

RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# Prune dev dependencies after build
RUN npm prune --omit=dev

# --- Production stage ---
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 eyano

ENV NODE_ENV=production

COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/auth/package.json ./packages/auth/
COPY --from=builder /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=builder /app/packages/ai/dist ./packages/ai/dist
COPY --from=builder /app/packages/ai/package.json ./packages/ai/
COPY --from=builder /app/packages/ai/node_modules ./packages/ai/node_modules

RUN chown -R eyano:nodejs /app
USER eyano

WORKDIR /app/apps/api

EXPOSE 3001

STOPSIGNAL SIGTERM

CMD ["node", "dist/main.js"]
