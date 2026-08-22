FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- Dependencies stage ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/auth/package.json ./packages/auth/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=apps/web

# --- Build stage ---
FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules

COPY tsconfig.json ./
COPY turbo.json ./
COPY package.json package-lock.json ./
COPY packages/types/ ./packages/types/
COPY packages/auth/ ./packages/auth/
COPY apps/web/ ./apps/web/

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}

RUN npm run build --workspace=apps/web

# Prune dev dependencies after build
RUN npm prune --omit=dev

# --- Production stage ---
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 eyano

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p /app/apps/web/public
COPY --from=builder /app/apps/web/public /app/apps/web/public

RUN mkdir -p /app/apps/web/.next
COPY --from=builder /app/apps/web/.next /app/apps/web/.next

COPY --from=builder /app/apps/web/next.config.js /app/apps/web/
COPY --from=builder /app/apps/web/package.json /app/apps/web/
COPY --from=builder /app/apps/web/node_modules /app/apps/web/node_modules

COPY --from=builder /app/packages/types/dist /app/packages/types/dist
COPY --from=builder /app/packages/types/package.json /app/packages/types/
COPY --from=builder /app/packages/types/node_modules /app/packages/types/node_modules
COPY --from=builder /app/packages/auth/dist /app/packages/auth/dist
COPY --from=builder /app/packages/auth/package.json /app/packages/auth/
COPY --from=builder /app/packages/auth/node_modules /app/packages/auth/node_modules

RUN chown -R eyano:nodejs /app
USER eyano

WORKDIR /app/apps/web

EXPOSE 3000

STOPSIGNAL SIGTERM

CMD ["node", "node_modules/.bin/next", "start"]
