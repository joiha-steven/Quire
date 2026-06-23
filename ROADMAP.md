# Roadmap

Direction for vibeblog beyond the current single-owner, Vercel-hosted blog. This is
a planning document — nothing here is built yet unless its status says so. Operational
detail for shipped features lives in [`CLAUDE.md`](./CLAUDE.md); the *why* of the
current design is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Goal

Make vibeblog something other people can actually run and live in - not just the
author's personal instance. Near-term tracks:

1. Run anywhere: **Vercel or Docker**, from one codebase.
2. Publish from a **Markdown note app** (Obsidian, then Craft).
3. Optional **AI assist** in the editor (titles, tags, drafting, images).

Long horizon (after Docker ships): a **free multi-tenant SaaS** at `vibeblog.app`
(see Phase 7). The whole point of the SaaS is the *opposite* of lock-in - it is "the
same open-source app, hosted for you", and any blog exports to a single snapshot that
re-installs on Docker or a Vercel + Supabase stack with one button. Hosted is a
convenience, never a trap.

## Architecture fit (why this is mostly additive)

Verified against the code: the only hard Vercel coupling is `@vercel/blob`.
Everything else already ports to a plain Node/Docker runtime:

- `sharp` does all image work (runs natively on Node — no Vercel image service).
- ISR + `revalidatePath`, the OG route, NextAuth and Markdown (gray-matter) all run
  under `next start` / standalone output.
- Text content lives in **Postgres via PostgREST** — the app uses only Supabase's REST
  layer, so self-host bundles **Postgres + PostgREST** and supabase-js is unchanged;
  binaries are store-relative on Blob (`collapseBlob`/`expandBlob`), so swapping the
  binary backend is mostly resolving a different base URL.

> **Done (2026-06-21, P1.5):** migrated all text from the old no-DB `_index.json` +
> `.md`-on-Blob model to Supabase Postgres (`src/lib/db.ts`). Binaries stay on Blob.
> The Phase 1 storage adapter below now concerns the BINARY store only.

So the roadmap is feature work on a sound base, not a rewrite.

## Decisions locked

- **No lock-in (hard principle).** Portability is a first-class feature, not an
  afterthought. A blog's full state is one portable snapshot (the existing Backup
  `.tar.gz` = `db.json` + all binaries + manifest), and that same format is the import
  path on every target. The SaaS must always offer one-button export to self-host, with
  no proprietary data trapped server-side. Transparency over retention - never hold a
  user's content hostage.
- **Storage is pluggable.** Self-host is fully independent of Vercel — default S3-
  compatible (MinIO / Cloudflare R2 / Backblaze) or local filesystem; Vercel Blob
  stays the default on Vercel.
- **Note app: Obsidian first** (Markdown-native, real plugin API). Craft is best-
  effort afterward (no comparable plugin API).
- **AI: bring-your-own key**, owner-only, server-side. Text via Claude (Anthropic);
  image generation via a separate provider (fal.ai / Replicate) since Claude does
  not generate images.

## Phases

### Phase 1 — Storage adapter `[shipped — Vercel Blob + local filesystem]`
`src/lib/blob.ts` is now a facade selecting a driver by `STORAGE_DRIVER`:
- **Vercel Blob** (current behaviour, default on Vercel) ✅
- **Local filesystem** (single volume, served under `/uploads`) ✅ — default for self-host
- **S3-compatible** (MinIO / R2 / B2) — *still planned*; same interface, drop-in driver

Public-URL resolution was the main work: Vercel Blob has public URLs; the local driver
serves files via `app/uploads/[...path]/route.ts`. `scripts/checks/no-direct-blob.mjs`
keeps the SDK contained so a self-host build can't silently reach Vercel Blob. The S3
driver later reused per-tenant in the SaaS as "bring your own bucket" (Phase 7).

### Phase 2 — Docker `[shipped — no-cloud stack]`
- `output: 'standalone'` + `Dockerfile` + `docker-compose.yml` (app + db + rest + cron). ✅
  The image builds with **no backend env** (data layer degrades to empty), so it is
  portable; env is supplied at runtime via `.env.docker`.
- **No cloud:** bundled **Postgres + PostgREST** (replaces Supabase) + local FS store
  (replaces Blob). supabase-js unchanged — `db.ts` strips the `/rest/v1` prefix when
  `POSTGREST_DIRECT=1`. `scripts/docker/gen-keys.mjs` mints DB password + JWT. ✅
- Cron: a sidecar pings `/api/cron` hourly (Vercel Cron has no off-platform equivalent). ✅
- *Still planned:* a GitHub Action that builds + publishes a versioned image to GHCR on
  each release tag, so updating is `docker compose pull && up -d`; optional bundled MinIO
  once the S3 driver lands.

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

### Phase 7 — Multi-tenant SaaS `[planned, needs Docker (Phases 1-2)]`

A **free, hosted** vibeblog at `vibeblog.app`: same open-source app, run for you. Built
only AFTER Docker ships, so every hosted blog has a guaranteed eject path - hosted is a
convenience, not a trap (see "No lock-in" in Decisions locked). This is the **model-A**
choice: one shared stack, many blogs, isolated by `tenant_id` (true multi-tenant, not
deploy-per-user). It is a large rewrite of the data layer, accepted deliberately.

**Tenancy (the foundation, biggest lift):**
- New `tenants` (id, owner_user_id, subdomain, custom_domain, plan, status) + `users`
  (auth identity, owner of a tenant). Add `tenant_id` to EVERY content table (`posts`
  `pages` `post_revisions` `media` `files` `settings` `mcp_tokens` `backup_state`
  `activity_log` `analytics_*`).
- `settings` drops the hardcoded `id=1` → one row per tenant.
- **Cache tags go per-tenant** (`db:<tenantId>` not the global `db`), or one user's save
  purges everyone's cache.
- **Blob paths get a tenant prefix** (`t/<tenantId>/...`); URLs stay deterministic from
  the one store token. Easiest part - blob I/O is already centralized.
- **Security:** the app uses `service_role` today (bypasses RLS). Multi-tenant requires
  either per-request clients scoped by JWT claims, or enforcing `tenant_id` in every
  query. This is the most sensitive surface - get it wrong and tenants read each other.

**Auth & routing:**
- Open signup, owner-per-tenant (replaces the single `AUTHORIZED_EMAIL`).
- Wildcard `*.vibeblog.app`; middleware resolves the tenant from the host. Admin at
  `app.vibeblog.app`. Custom domains via the Vercel Domains API + automated SSL.

**Portability backbone (the headline promise):**
- Reuse Backup/Restore as the universal interchange format. **Export** = the tenant's
  slice as a `.tar.gz`; **Import** = restore that snapshot into a fresh Docker or
  Vercel + Supabase install. Make import a first-class onboarding step on self-host.
- One button to leave, no proprietary state left behind.

**Plans (this is a hobby, never for profit):**
- **Free, for everyone**: 1GB storage AND custom domain - no questions, no upsell games,
  no feature held back. The free tier is the product; the operator's own salary covers
  its running cost. Custom domain is obviously free.
- **Paid, only for heavy/professional users who outgrow 1GB**: buy more storage for
  yourself when you genuinely need it. Priced later, **just enough to cover cost, kept
  super cheap** - it offsets storage, it does not make money.
- **Bring your own bucket (BYOS)**: a tenant can connect their own Cloudflare R2 / S3
  bucket; their binaries live there, on their dime, effectively unlimited and entirely
  outside our quota. This just applies the **Phase 1 storage adapter per-tenant** (the
  same interface that powers self-host). It reinforces no-lock-in - the media sits
  literally in the user's own bucket - and a heavy user need not pay us at all.

**Why "free" stays sustainable:** text in Postgres is tiny (a blog's DB stays well under
1GB); **binaries are the only real cost driver**. With BYOS offloading the heavy media to
users' own buckets and the shared DB staying small, the operator's running cost barely
grows with users - the free tier holds almost indefinitely.

**Cost & abuse guardrails (make-or-break for "free"):**
- Per-blog storage quota + rate limits; reap/flag long-dead free blogs.
- Hosting user content = real liability: ToS, content reporting, a per-tenant kill
  switch, DMCA path. Plan this in, not after.

## Accepted limitations (current design)

- Single author (one `AUTHORIZED_EMAIL`) per instance. No multi-user / roles in the
  self-host build - multi-tenant arrives only in the SaaS (Phase 7), which lifts this.
- `_index.json` is read in full per list regeneration — fine to the low hundreds of
  posts; sharding would be needed well beyond that.
- Related-posts box on other posts can lag up to the ISR window after a new post
  (see CLAUDE.md caching notes); the "Clear all cache" button is the instant fix.
