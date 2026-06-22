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

### Phase 3 — Token auth + ingest API `[partly done]`
> **Done (2026-06-22, v1.0.0):** token auth + external publishing landed as the **MCP
> server** (`/api/mcp`) — a single full-access `MCP_TOKEN` (+ thin OAuth for connectors)
> lets an agent create/update/delete posts & pages, manage media/files, and read settings,
> all through the same data layer. `add_media_from_url` rehosts an image URL to Blob.

Still planned: a plain HTTP **ingest endpoint** that takes Markdown + frontmatter and maps
it to post fields (for the note-app plugins below), rehosting embedded images.
(`scripts/legacy/rehost-images.mjs` and `legacy/import-wordpress.mjs` are existing patterns to build on.)

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

### Phase 6 — Native comments `[planned, independent]`

Reader comments with **no third-party login** (giscus was rejected for exactly this —
it forces a GitHub account). Fully self-hosted on the existing Supabase Postgres,
owner-moderated, spam-guarded by **Cloudflare Turnstile**. A `features.comments` toggle
gates the whole thing (re-added; removed when the giscus spike was dropped).

**Data model** — new `comments` table:
- `id` (uuid), `post_slug` (text, references a post), `author_name` (text, required),
  `author_email` (text, required, **never shown publicly** — used for a Gravatar hash,
  dedup, and optional owner notify), `body` (text, plain/lightly-formatted),
  `status` (`pending` | `approved` | `spam`, default `pending`), `created_at`,
  `ip` + `user_agent` (abuse triage). Optional v2: `parent_id` for threaded replies.
- Index on `(post_slug, status, created_at)`.

**Public flow:**
- Comment form at the end of a post: name + email + body, plus a hidden **honeypot**
  field and the **Turnstile** widget.
- `POST /api/comments` → verify Turnstile (server-side `siteverify`) + honeypot empty +
  per-IP rate-limit → insert as `pending`. Reader sees "awaiting moderation".
- Only `approved` rows render. **Keep the post page SSG** by loading comments through a
  small client component (`GET /api/comments?slug=`) instead of server-reading them —
  the article HTML stays ISR/static; comments hydrate after.

**Moderation (admin):**
- New `/admin/comments` page (force-dynamic): pending + approved lists, newest first,
  filter by status / post. Actions: approve, unapprove, mark spam, delete, with bulk
  select. A pending-count badge in the admin nav.
- Log each action to the activity log (`comment.approve` / `comment.spam` /
  `comment.delete`).

**Spam protection:**
- **Cloudflare Turnstile** (free, privacy-friendly, no puzzle) — env
  `TURNSTILE_SITE_KEY` (public) + `TURNSTILE_SECRET_KEY` (server). Verified before every
  insert.
- Honeypot field + minimum time-on-page + per-IP rate-limit. Optional link/keyword
  heuristics auto-flag obvious spam straight to `spam`.

**Out of scope for v1 (later):** email-notify the owner on a new pending comment
(Resend or similar); threaded replies; reactions.

**i18n:** form labels, validation/awaiting-moderation messages, and the moderation UI
go through `src/locales/` (+ admin) like everything else.

## Accepted limitations (current design)

- Single author (one `AUTHORIZED_EMAIL`). No multi-user / roles planned.
- `_index.json` is read in full per list regeneration — fine to the low hundreds of
  posts; sharding would be needed well beyond that.
- Related-posts box on other posts can lag up to the ISR window after a new post
  (see CLAUDE.md caching notes); the "Clear all cache" button is the instant fix.
