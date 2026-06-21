# Roadmap

Direction for vibeblog beyond the current single-owner, Vercel-hosted blog. This is
a planning document — nothing here is built yet unless its status says so. Operational
detail for shipped features lives in [`CLAUDE.md`](./CLAUDE.md); the *why* of the
current design is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Goal

Make vibeblog something other people can actually run and live in — not just the
author's personal instance. Three tracks:

1. Run anywhere: **Vercel or Docker**, from one codebase.
2. Publish from a **Markdown note app** (Obsidian, then Craft).
3. Optional **AI assist** in the editor (titles, tags, drafting, images).

## Architecture fit (why this is mostly additive)

Verified against the code: the only hard Vercel coupling is `@vercel/blob`.
Everything else already ports to a plain Node/Docker runtime:

- `sharp` does all image work (runs natively on Node — no Vercel image service).
- ISR + `revalidatePath`, the OG route, NextAuth and Markdown (gray-matter) all run
  under `next start` / standalone output.
- Text content lives in **Supabase Postgres** (any Postgres works for self-host);
  binaries are store-relative on Blob (`collapseBlob`/`expandBlob`), so swapping the
  binary backend is mostly resolving a different base URL.

> **Done (2026-06-21, P1.5):** migrated all text from the old no-DB `_index.json` +
> `.md`-on-Blob model to Supabase Postgres (`src/lib/db.ts`). Binaries stay on Blob.
> The Phase 1 storage adapter below now concerns the BINARY store only.

So the roadmap is feature work on a sound base, not a rewrite.

## Decisions locked

- **Storage is pluggable.** Self-host is fully independent of Vercel — default S3-
  compatible (MinIO / Cloudflare R2 / Backblaze) or local filesystem; Vercel Blob
  stays the default on Vercel.
- **Note app: Obsidian first** (Markdown-native, real plugin API). Craft is best-
  effort afterward (no comparable plugin API).
- **AI: bring-your-own key**, owner-only, server-side. Text via Claude (Anthropic);
  image generation via a separate provider (fal.ai / Replicate) since Claude does
  not generate images.

## Phases

### Phase 1 — Storage adapter `[planned]`
Turn `src/lib/blob.ts` (today the single I/O point) into an interface with adapters
selected by env var:
- **Vercel Blob** (current behaviour, default on Vercel)
- **S3-compatible** (MinIO / R2 / B2) — default for self-host
- **Local filesystem** (single volume, smallest setups)

Public-URL resolution is the main work (Vercel Blob has public URLs; S3/FS need a
public bucket or a proxy route). Foundation for Docker.

### Phase 2 — Docker `[planned, needs Phase 1]`
- `output: 'standalone'` + `Dockerfile` + `docker-compose.yml` (app + optional MinIO).
- GitHub Actions builds and publishes a versioned image to GHCR on each release tag.
- Updating is `docker compose pull && up -d` (or Watchtower for auto-update).

One codebase, one CI: the same source produces both the Vercel deploy and the Docker
image — there is no second version to maintain.

### Phase 3 — Token auth + ingest API `[planned]`
API-token auth alongside OAuth, so external tools can publish. An endpoint that takes
Markdown + frontmatter, **rehosts embedded images** to storage, and maps frontmatter
to post fields. (`scripts/rehost-images.mjs` and `import-wordpress.mjs` are existing
patterns to build on.)

### Phase 4 — Obsidian, then Craft `[planned, needs Phase 3]`
- **Obsidian plugin**: a command that POSTs the active note (frontmatter + body) and
  its attachments to the ingest API. vibeblog already stores exactly this format.
- **Craft**: best-effort — Markdown export → paste-import in admin, or pull via the
  Craft API where possible.

### Phase 5 — AI assist `[planned, independent]`
Owner-gated `/api/ai/*` routes; key in env, never client-exposed:
- Text (Claude): suggest title, tags/categories, excerpt; draft / rewrite a selection.
- Image (fal.ai / Replicate): generate, then upload to storage as featured image.

Independent of Phases 1–4 — could be done first as a quick win.

## Accepted limitations (current design)

- Single author (one `AUTHORIZED_EMAIL`). No multi-user / roles planned.
- `_index.json` is read in full per list regeneration — fine to the low hundreds of
  posts; sharding would be needed well beyond that.
- Related-posts box on other posts can lag up to the ISR window after a new post
  (see CLAUDE.md caching notes); the "Clear all cache" button is the instant fix.
