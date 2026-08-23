FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat

WORKDIR /app

# ============================================================
# Dependencies
# ============================================================

FROM base AS deps

COPY package.json package-lock.json ./

COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/auth/package.json ./packages/auth/

RUN npm ci

# ============================================================
# Build
# ============================================================

FROM base AS builder

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY turbo.json ./

COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/auth/package.json ./packages/auth/

COPY packages/types/ ./packages/types/
COPY packages/auth/ ./packages/auth/
COPY apps/web/ ./apps/web/

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}

RUN npm run build --workspace=@eyano/types
RUN npm run build --workspace=@eyano/auth
RUN npm run build --workspace=@eyano/web

# ============================================================
# Production
# ============================================================

FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 eyano

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Root dependencies
COPY --from=builder /app/node_modules ./node_modules

# Web application
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

# next.config.js if present
COPY --from=builder /app/apps/web/next.config.js ./apps/web/next.config.js

# Public directory
COPY --from=builder /app/apps/web/public ./apps/web/public

# Internal packages
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json

COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/auth/package.json ./packages/auth/package.json

RUN chown -R eyano:nodejs /app

USER eyano

WORKDIR /app/apps/web

EXPOSE 3000

STOPSIGNAL SIGTERM

CMD ["../../node_modules/.bin/next", "start"]