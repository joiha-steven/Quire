# quire self-host image. Builds the Next standalone server (output: 'standalone')
# and runs it as a plain Node process. Binaries live on the local filesystem in a
# mounted /app/uploads volume. The build needs NO backend env: the data layer
# degrades to empty when the DB is absent, so static generation produces nothing and
# pages render on-demand at runtime once .env is supplied. Postgres + Google OAuth
# are external (the compose stack bundles Postgres + PostgREST).

# --- deps: install all dependencies (dev included, needed to build) --------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the standalone server --------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner: minimal runtime image -----------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Storage: binaries live on the local filesystem under the mounted volume.
ENV STORAGE_LOCAL_DIR=/app/uploads

# Standalone output + the assets it does not bundle (static chunks, public/).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Writable dirs for the unprivileged node user: the binary store, and the whole
# .next tree. Next 16 writes its prerender/segment cache under .next/server/app/*
# (not just .next/cache) at runtime, but standalone copies .next as root — so the
# runtime user must own all of .next, else ISR revalidation fails with EACCES.
RUN mkdir -p /app/uploads /app/.next/cache && chown -R node:node /app/uploads /app/.next
USER node

EXPOSE 3000
CMD ["node", "server.js"]
