# vibeblog self-host image. Builds the Next standalone server (output: 'standalone')
# and runs it as a plain Node process — no Vercel. Storage is the local filesystem
# driver (STORAGE_DRIVER=local); binaries live in a mounted /app/uploads volume.
# The build needs NO backend env: the data layer degrades to empty when the DB is
# absent, so static generation produces nothing and pages render on-demand at
# runtime once .env is supplied. Postgres (Supabase) + Google OAuth stay external.

# --- deps: install all dependencies (dev included, needed to build) --------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the standalone server --------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Client bundle bakes the storage driver in at build time, so it MUST be set here
# (not just at runtime) for the browser upload path to choose the local route.
ENV NEXT_PUBLIC_STORAGE_DRIVER=local
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
# Storage: local filesystem driver, binaries under the mounted volume.
ENV STORAGE_DRIVER=local
ENV NEXT_PUBLIC_STORAGE_DRIVER=local
ENV STORAGE_LOCAL_DIR=/app/uploads

# Standalone output + the assets it does not bundle (static chunks, public/).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Writable dirs for the unprivileged node user: the binary store, and the ISR
# incremental cache (standalone copies .next/static as root, but never ships
# .next/cache — Next creates it at runtime and must be able to write there).
RUN mkdir -p /app/uploads /app/.next/cache && chown -R node:node /app/uploads /app/.next/cache
USER node

EXPOSE 3000
CMD ["node", "server.js"]
