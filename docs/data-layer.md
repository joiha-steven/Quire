> Split from CLAUDE.md. How data reaches a reader and how it is invalidated: the
> operational shape, the `src/lib` map, the caching contract, and the post render path.
> The *why* behind these choices is in [`../ARCHITECTURE.md`](../ARCHITECTURE.md);
> the rules they must not break are in [`invariants.md`](./invariants.md).

# Data layer, caching, rendering

## Architecture (operational)

- **Text in Postgres (self-hosted; reached through PostgREST with the `@supabase/postgrest-js` client —
  bundled Postgres+PostgREST on Docker, or your own on native, see Env); binaries on the LOCAL FILESYSTEM via
  the `blob.ts` facade** (served at `/uploads`; `STORAGE_LOCAL_DIR`). Tables (schema `public`):
  `posts` `pages` `post_revisions` `media` `files` `comments` `settings` `mcp_tokens` `mcp_clients`
  `mcp_used_codes` `backup_state` `integration_keys` `activity_log` `analytics_events` `analytics_scroll` `redirects` `subscribers` `newsletter_sends` — full DDL in
  `scripts/schema.sql`; data-model shapes + the *why* in ARCHITECTURE.md.
  `backup_state` (single row) holds the **secret** Drive refresh token + run state and
  is NEVER read into the client-bound settings payload (see `docs/backups.md`).
- `src/lib` = data layer (`db.ts` Postgres, `blob.ts` binaries); `src/app/api` = thin
  owner-gated handlers; UI in `src/components`. Writes are atomic upserts/deletes (no
  read-modify-write manifest); reads always fresh + transactional.
- **Data flow:** public read = server component → `src/lib` (`getPost`/`getSettings`/…) →
  `marked` render (ISR-cached). Write = `src/app/api/*` route → `requireOwner()` → `src/lib`
  mutate Postgres/Blob → `src/lib/revalidate.ts` purge.
- **Env:** `POSTGREST_URL` (your PostgREST endpoint, the one serving tables at `/<table>`) +
  `POSTGREST_TOKEN` (HS256 `service_role` JWT, server-only) + `STORAGE_LOCAL_DIR` + `SITE_URL`/`AUTH_URL` +
  `AUTH_*` + `AUTHORIZED_EMAIL` + `CRON_SECRET`. MCP enabled + tokenized from the admin (no `MCP_TOKEN`
  env); optional `MCP_OAUTH_SECRET` signs OAuth codes (falls back to `AUTH_SECRET`). DB password +
  JWT secret + service token come from `scripts/docker/gen-keys.mjs`, roles/grants from `docker/initdb/`.
  **Native:** `.env.example` + `docs/self-host-native.md`. **Docker:** `.env.docker.example` (bundles
  Postgres + PostgREST + local store + cron). Build needs no backend env (data layer degrades to empty).
  **Boot:** `src/instrumentation.ts` runs `validateEnv()` (`src/env.ts`) at server start (NOT build/edge)
  and fails fast on missing required vars. **Upgrades:** `scripts/migrate.sh` applies pending
  `scripts/migrations/*.sql` tracked in `schema_migrations` (Docker runs it as a one-shot; fresh installs
  seed the ledger from `schema.sql`). **Probe:** `GET /api/health` (DB + store writable).
- **Edge:** put a CDN/reverse proxy (e.g. Cloudflare) in front for global caching + TLS/HSTS; OG runs on
  the edge runtime (so its bundled font loads). Detail → `docs/seo-pwa.md`.

## Data layer map — `src/lib/`

Terse role per file; the authoritative detail is the code comments.

| File | Key exports | Role |
|---|---|---|
| `db.ts` | `db()` | Server-only `service_role` PostgREST client (`@supabase/postgrest-js` — the standalone query builder, NOT supabase-js); GET reads cache-eligible + tagged `db`, writes `no-store`. ALL text access goes through here |
| `blob.ts` | `blobUrl`, `uploadFile`, `readBlob`, `deleteByUrl/Pathname`, `listBlobs`, `blobOrigin`, `collapseBlob`, `expandBlob` | Binaries only; facade over the LOCAL fs driver `blob-local.ts` (served at `/uploads` via `app/uploads/[...path]`), lazy-loaded so `node:fs` stays off the client. `collapse/expand` = store-relative refs. No cloud storage SDK anywhere in `src` (`check:no-direct-blob`) |
| `posts.ts` | `getIndex`, `getPublicPosts`, `getPost`, `savePost`, `deletePost`, `getCategories`, `getTags`, `updateTerm` | Reads `React.cache()` only. `savePost` snapshots prior version + stores `readingMinutes`. `updateTerm` renames (merges on collision) / removes a term across EVERY post |
| `pages.ts` | `getPageIndex`, `getPublicPages`, `getPage`, `savePage`, `deletePage` | Mirrors `posts.ts` |
| `revisions.ts` | `getRevisions`, `pushRevision`, `renameRevisions`, `deleteRevisions` | Last 3 overwritten versions/slug (`post_revisions` jsonb, store-relative). Re-slugged on rename, removed on delete |
| `media.ts` | `getMedia`, `addMedia*`, `registerMediaBatch`, `deleteMedia*`, `finalizeContentMedia`, `finalizePendingVariants/Thumbs` | Metadata in `media` (`path` = PK), binaries on Blob. Browser→server multipart (`/api/media/upload`) writes bytes then thumbs+dims. ORIGINAL written with an EXCLUSIVE (O_EXCL) write so concurrent same-name uploads retry a fresh name (never overwrite → no PK 500); dims+thumb are best-effort (a valid original never fails the upload). Heavy `-1024/-1600` AVIF+WebP deferred via `after()`, cron-swept. Delete removes EVERY version. `PostContent` emits `<picture>` only when variants exist |
| `files.ts` | `renderLogo`, `uploadIcon`, `uploadFont`, `getFiles`, `addFilesBatch`, `deleteFile*`, `getSiteIcons` | `files/` prefix = custom font, site icons (`favicon-`/`app-icon-`), attachment library. `deleteFile*` refuse `favicon-`/`app-icon-` |
| `settings.ts` | `getSettings`, `saveSettings`, `DEFAULT_SETTINGS`, `resolveAppIcon`, `typographyToCss`, `fontToCss` | `React.cache()` only. Holds `themes` + `typography` + `customFont`; migrates legacy shapes; image/font urls store-relative |
| `themes.ts` | `THEME_PRESETS`, `themesToCss`, `paletteOptions`, … | 6 owner-customizable palettes. `themesToCss` emits EVERY palette's vars. Add one = append to `THEME_PRESETS` |
| `comments.ts` / `comment-md.ts` | `getCommentTree`, `buildCommentTree`, `addComment`, `countsByPosts`, `renderCommentMarkdown` | Text-only reader comments (off by default). Public tree excludes email, tombstones deleted-but-replied, re-roots orphans. `comment-md` = bold/italic-only, escape-first. Client island fetches no-store → instant, no revalidate |
| `integration-keys.ts` / `comment-env.ts` | `getIntegrationKeys`, `getIntegrationStatus`, `saveIntegrationKeys`, `getCommentEnv` | SERVER-ONLY Turnstile secrets in `integration_keys` table (env fallback), set in admin — like `backup_state`, NEVER in `settings.data`. `getCommentEnv` (async) = which comment integrations are usable + public site key |
| `analytics.ts` | `recordView`, `recordScroll`, `getAnalytics`, `getPageAnalytics`, `getViewTotals`, `isBot` | Cookieless; `visitor` = salted hash of IP+UA (no PII); bots + admin/api + owner skipped. Kept FOREVER. `recordView` stores COARSE UA buckets (device/browser/os via `ua.ts`) — never the raw UA. `recordScroll` also samples dwell (ms). Buckets truncated in `ANALYTICS_TZ`. v2 sections (engagement/channels/audience/drill-down) need `2026-07-22-analytics-v2.sql`; fall back to base shape until applied |
| `activity.ts` | `logActivity`, `logActivityError`, `getActivity`, `clearActivity` | `activity_log`; gated by `features.activityLog`, never throws; `logActivity` called via `after()` from every mutating route; `logActivityError` (action `error`) is scheduled by `logError` (`api.ts`) on route failures |
| `media-usage.ts` | `findUnusedMedia` | Read-only audit; badges orphans, never deletes |
| `backup.ts` / `backup-state.ts` / `gdrive.ts` | (see `docs/backups.md`) | Drive snapshot/restore + the server-only secret store + Drive REST/OAuth |
| `highlight.ts` | `highlightCode` | Server-side Shiki; zero client JS; null on failure → plain block |
| `auth.ts` | `handlers`, `auth`, `signIn/Out`, `isAuthorized`, `getAuthState` | Anyone signs in; only `AUTHORIZED_EMAIL` is authorized |
| `slugs.ts` | `ensureSlugFree`, `SlugConflictError` | Posts + pages share the namespace → 409 on collision |
| `revalidate.ts` | `revalidateNewPost/Post/Page/Everything`, `warmCache` | Single source of cache invalidation (see Caching) |
| `api.ts` | `ok`, `fail`, `logRequest`, `logError`, `requireOwner` | Every route calls `requireOwner()` first |
| `taxonomy.ts` | `termSlug`, `resolveTerm` | Category/tag URL slug + reverse-resolve a slug to its display name (back-compat with raw pre-slug URLs) |
| `wordpress-import.ts` | `parseWxr` | Pure WXR (.xml) → posts/pages (turndown HTML→MD); no I/O. `api/import/wordpress` persists via savePost/savePage |
| `redirects.ts` / `redirect-path.ts` | `getRedirects`, `saveRedirect`, `deleteRedirect`, `clearRedirectForPath` / `normalizePath`, `isValidDestination` | User-managed 301/302 rows (`redirects` table). Resolved in `middleware.ts` (real HTTP redirect, edge-safe fetch — NOT `db()`). `redirect-path.ts` is pure + import-safe from the edge middleware. savePost/savePage auto-add a 301 on rename + clear a live slug's stale redirect |
| `series.ts` / `series-order.ts` | `getSeriesForPost`, `getSeriesList`, `resolveSeries`, `getAllSeriesNames`, `updateSeries`, `reorderSeries` / `orderSeries`, `seriesEntries` (pure) | Post series = `series`+`series_order` columns (no table). Ordered public siblings for the `SeriesBox`; `/series/[slug]` listing; admin rename/remove/reorder. Pure order/grouping lives in `series-order.ts` (client/edge-safe — no db); `series.ts` re-exports it. Built on cached `getPublicPosts`/`getIndex` |
| `subscribers.ts` / `mail.ts` / `newsletter-log.ts` | `addSubscriber`, `confirmSubscriber`, `unsubscribeByToken`, `getConfirmedSubscribers`, `listSubscribers` / `getSmtpConfig`, `saveSmtpConfig`, `sendMail`, `isMailConfigured` / `logSend`, `statsByEmail`, `statsByPost`, `recordOpen`, `newOpenToken` | Newsletter double opt-in (`subscribers` table, per-row token) + Nodemailer SMTP (config on `integration_keys`, server-only, env fallback). `sendMail` never throws — degrades when unconfigured — and is the ONE choke point that writes `newsletter_sends` (one row per email, every kind, success or failure) |
| `broadcast.ts` / `comment-notify.ts` / `newsletter-email.ts` | `broadcastPosts`, `previewBroadcast` / `notifyReply` / `confirmEmail`, `broadcastEmail`, `replyEmail` | MANUAL broadcast only, one or MORE posts per send (several = ONE digest email, not one each); email HTML = table layout + inline styles; identity (palette + masthead logo) from `lib/email-brand.ts` `emailBrand(settings)`. Email logo = `settings.logoEmailUrl`, a PNG twin `renderLogo` emits beside the WebP web render (WebP is dead in Outlook); falls back to a mail-safe original, then to the site name as text. — the cron publishes but never emails; the owner picks a post in Admin → Newsletter, reviews the real HTML and presses send. Double-send guard reads the SEND LOG (not `broadcast_at`, which older posts carry from the retired auto-send); `force` overrides. Reply-notify: `after()` from the comment route emails the parent commenter. Email HTML = the pure escaped builders |
| `rate-limit.ts` | `rateLimited`, `clientIp` | Shared in-memory per-IP sliding window; applied to public `track`/`search`/`mcp/register` (generous limits) |
| others | `scheduled.ts` (`sweepScheduled`/`newlyLive` — future-dated published posts go live on time via cron), `footnotes.ts` (`prepareFootnotes`/`applyFootnotes` — `[^id]` refs+defs around marked, code-masked), `ua.ts` (coarse device/browser/os buckets — no raw UA), `video.ts` (video + Spotify/Apple Music iframe embeds), `paginate.ts`, `i18n.ts`, `admin-i18n.ts`, `og.ts`, `preview.ts`, `upload-client.ts`, `toc.ts`, `inline-md.ts`, `comment-tree.ts`, `image.ts`, `mime.ts`, `cdn.ts`, `safe-fetch.ts`, `settings-sanitize.ts`, `turnstile.ts`, `utils.ts` (`slugify`/`deriveExcerpt`/`escapeHtml`/`isPublicallyVisible`) | Pure/shared helpers |

## Caching — ISR pages + tagged DB reads, purge on save

Two coordinated layers, both invalidated on every write so an edit is never stale. **Full
mechanism + the *why* (and the old no-DB bug it replaced) → ARCHITECTURE.md "Request flow".**

- Public pages export `revalidate = 3600`; `/[slug]` also has `generateStaticParams` (prerendered).
  `db.ts` GET reads are cache-eligible + tagged `db`; writes are `no-store`. Pagination is
  path-based (`/page/[n]`, `/category|tag/[slug]/page/[n]`; page 1 at the bare path).
- Every admin write goes through `lib/revalidate.ts` (Invariant 1) — `freshenData()` then a `revalidatePath` superset; `Everything` (settings/taxonomy/media-delete/Clear) also `warmCache()`.
- **GOTCHA — admin LIVE reads need `fetchCache = 'force-no-store'`, NOT just `dynamic =
  'force-dynamic'`.** `db()` GET reads set an explicit `next:{revalidate,tags:['db']}` which
  `force-dynamic` does NOT de-cache — so a tagged read stays in the 1h Data Cache and shows STALE
  rows after an OUT-OF-BAND mutation that doesn't purge tag `db` (MCP/OAuth token mints, cron backup
  state). Set `fetchCache = 'force-no-store'` on the `/admin` layout AND the owner-only list API
  routes not under `/admin` (`api/mcp/tokens`, `api/files`, `api/media`, `api/media/unused`,
  `api/posts/[slug]/revisions`, `api/backup`). (Caused "token list missing" + the 1.0.11–1.0.13 bug.)
- **DO NOT** set `db()` GET reads to `no-store` (kills ISR) or enable `cacheComponents: true`; keep every write going through `revalidate.ts`.

## Rendering — `src/app/(blog)/[slug]/page.tsx`

- `revalidate = 3600` + `generateStaticParams` (all slugs) + `dynamicParams`. Reads `getPost` +
  `getPage` (shared `/{slug}` namespace) + `getMedia` (the `<picture>` set). Admin `/admin/*` +
  search/preview/og are dynamic.
- **Taxonomy URLs use the SLUGIFIED term** (`lib/taxonomy.ts`): links call `termSlug(term)`, the
  `category|tag/[slug]` routes call `resolveTerm(...)` → `notFound()` if none. New taxonomy
  link/route MUST go through these (never hand-encode the name).

