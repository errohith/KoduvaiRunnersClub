# syntax=docker/dockerfile:1.7
# Multi-stage build: deps → build → slim runtime (Next.js standalone output).
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build without secrets: configuration is validated at runtime, not build time.
RUN npx prisma generate && npx next build

# Web server
FROM base AS web
ENV NODE_ENV=production
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
COPY --from=build --chown=app /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /app/uploads && chown app /app/uploads
USER app
EXPOSE 3000
CMD ["node", "server.js"]

# Worker + migrations + seed (full toolchain)
FROM base AS tools
ENV NODE_ENV=production
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /app ./
USER app
CMD ["npx", "tsx", "src/worker/run.ts"]
