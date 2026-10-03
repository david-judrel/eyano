FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# ============================================================
# Dependencies
# ============================================================

FROM base AS deps

COPY package.json package-lock.json ./

COPY packages/types/package.json ./packages/types/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/gnoxe-brains/package.json ./packages/gnoxe-brains/
COPY packages/eyano-identity/package.json ./packages/eyano-identity/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=apps/api

# ============================================================
# Builder
# ============================================================

FROM base AS builder

# Root node_modules
COPY --from=deps /app/node_modules ./node_modules

# Root configuration
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY turbo.json ./

# Workspace package manifests
COPY packages/types/package.json ./packages/types/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/gnoxe-brains/package.json ./packages/gnoxe-brains/
COPY packages/eyano-identity/package.json ./packages/eyano-identity/
COPY apps/api/package.json ./apps/api/

# Workspace source code
COPY packages/types/ ./packages/types/
COPY packages/database/ ./packages/database/
COPY packages/auth/ ./packages/auth/
COPY packages/gnoxe-brains/ ./packages/gnoxe-brains/
COPY packages/eyano-identity/ ./packages/eyano-identity/
COPY apps/api/ ./apps/api/

# ============================================================
# Prisma
# IMPORTANT: Prisma Client must be generated BEFORE
# compiling @eyano/database because database/src/index.ts
# imports types from @prisma/client.
# ============================================================

RUN npm run db:generate

# ============================================================
# Build shared packages
# ============================================================

RUN npm run build --workspace=@eyano/types

RUN npm run build --workspace=@eyano/auth

RUN npm run build --workspace=@eyano/database

RUN npm run build --workspace=@eyano/gnoxe-brains

RUN npm run build --workspace=@eyano/eyano-identity

# ============================================================
# Build API
# ============================================================

RUN npm run build --workspace=@eyano/api

# ============================================================
# Production
# ============================================================

FROM base AS runner

RUN addgroup --system --gid 1001 nodejs

RUN adduser --system --uid 1001 eyano

ENV NODE_ENV=production

WORKDIR /app

# ============================================================
# Root dependencies
# ============================================================

COPY --from=builder /app/node_modules ./node_modules

# ============================================================
# Prisma generated client
# ============================================================

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# ============================================================
# API
# ============================================================

COPY --from=builder /app/apps/api/dist ./apps/api/dist

COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Scripts d'exploitation (creation du premier super-administrateur)
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts

# ============================================================
# Types
# ============================================================

COPY --from=builder /app/packages/types/dist ./packages/types/dist

COPY --from=builder /app/packages/types/package.json ./packages/types/package.json

# ============================================================
# Database
# ============================================================

COPY --from=builder /app/packages/database/dist ./packages/database/dist

COPY --from=builder /app/packages/database/package.json ./packages/database/package.json

COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
# ============================================================
# Auth
# ============================================================

COPY --from=builder /app/packages/auth/dist ./packages/auth/dist

COPY --from=builder /app/packages/auth/package.json ./packages/auth/package.json

# ============================================================
# GnoxeBrains
# ============================================================

COPY --from=builder /app/packages/gnoxe-brains/dist ./packages/gnoxe-brains/dist

COPY --from=builder /app/packages/gnoxe-brains/package.json ./packages/gnoxe-brains/package.json

# ============================================================
# Eyano Identity
# ============================================================

COPY --from=builder /app/packages/eyano-identity/dist ./packages/eyano-identity/dist

COPY --from=builder /app/packages/eyano-identity/package.json ./packages/eyano-identity/package.json

# ============================================================
# Permissions
# ============================================================

RUN chown -R eyano:nodejs /app

USER eyano

# ============================================================
# API
# ============================================================

WORKDIR /app/apps/api

EXPOSE 3001

STOPSIGNAL SIGTERM

CMD ["node", "dist/main.js"]