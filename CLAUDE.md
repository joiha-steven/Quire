@AGENTS.md

# Quire Blog — operating notes

Public, open-source blog platform. **Zero personal data in this repo.** Real
credentials live only in the gitignored `.env.local` (native) or `.env.docker`
(Docker); never commit them. Personal/instance facts are not tracked in git.

> **Companion doc — don't duplicate it here.** [`ARCHITECTURE.md`](./ARCHITECTURE.md) =
> the mental model + the *why* behind decisions. This file = operational rules, invariants,
> and a per-area DEBUG ROUTER. When they'd overlap, the *why* lives there, the *rule* lives
> here. DB schema = [`scripts/schema.sql`](./scripts/schema.sql). Per-area detail lives in
> [`docs/`](./docs/) — the DEBUG ROUTER points you at the right file; don't preload them all.

## Working principles

How to work in this repo. These bias toward caution over speed; for trivial changes,
use judgment. They reinforce the Conventions below — read both.

**1. Think before coding — don't assume, don't hide confusion, surface tradeoffs.**
State assumptions explicitly; if uncertain, ask (use AskUserQuestion for genuine
forks). If multiple interpretations exist, present them — don't pick silently. If a
simpler approach exists, say so and push back when warranted. If something is unclear,
stop, name what's confusing, and ask.

**2. Simplicity first — the minimum code that solves the problem, nothing speculative.**
No features beyond what was asked. No abstractions for single-use code. No "flexibility"
that wasn't requested. No error handling for impossible scenarios. If 200 lines could be
50, rewrite it. Ask: "would a senior engineer call this overcomplicated?" — if yes,
simplify. (This is also why the `lib/` data layer is thin and routes are thin handlers.)

**3. Surgical changes — touch only what you must; clean up only your own mess.** Don't
"improve" adjacent code/comments/formatting. Don't refactor what isn't broken. Match the
existing style even if you'd do it differently. Remove imports/vars/functions that YOUR
change orphaned; do NOT delete pre-existing dead code unless asked — mention it. Every
changed line traces to the request. **Mandatory exception:** when you change behavior,
update the matching docs in the SAME change (see "Conventions") — that's part of the
request, not scope creep.

**4. Goal-driven execution — define success criteria, then loop until verified.** Recast a task
as something checkable ("fix the bug" → "I reproduce it, then it's gone"); state a brief plan with
a verify step. **Definition of Done — a change is DONE only when `npm run check:all` exits 0**
(typecheck + lint + `check:routes`/`check:filesize`/`check:no-any`/`check:no-direct-blob` + the `npm test` seam net;
offline, no creds). No "it compiles" exception; if a change touches behaviour not in `check:all`,
add a test for it IN THE SAME commit. Seams pin load-bearing invariants only (see Invariants), NOT
broad coverage; a release batch also runs `npm run build` + the `audit/` procedure + manual checks
a script can't. **Suspect data drift (media/blob mismatch)? Run `npm run check:consistency:live`
BEFORE reading code** (live, needs `.env.local`; skips cleanly without creds). Report failures honestly.

## Architecture (operational)

- **Text in Postgres (self-hosted; reached through PostgREST with the `supabase-js` client — bundled
  Postgres+PostgREST on Docker, or your own on native, see Env); binaries on the LOCAL FILESYSTEM via
  the `blob.ts` facade** (served at `/uploads`; `STORAGE_LOCAL_DIR`). Tables (schema `public`):
  `posts` `pages` `post_revisions` `media` `files` `settings` `mcp_tokens` `mcp_clients`
  `mcp_used_codes` `backup_state` `activity_log` `analytics_events` `analytics_scroll` — full DDL in
  `scripts/schema.sql`; data-model shapes + the *why* in ARCHITECTURE.md.
  `backup_state` (single row) holds the **secret** Drive refresh token + run state and
  is NEVER read into the client-bound settings payload (see `docs/backups.md`).
- `src/lib` = data layer (`db.ts` Postgres, `blob.ts` binaries); `src/app/api` = thin
  owner-gated handlers; UI in `src/components`. Writes are atomic upserts/deletes (no
  read-modify-write manifest); reads always fresh + transactional.
- **Data flow:** public read = server component → `src/lib` (`getPost`/`getSettings`/…) →
  `marked` render (ISR-cached). Write = `src/app/api/*` route → `requireOwner()` → `src/lib`
  mutate Postgres/Blob → `src/lib/revalidate.ts` purge.
- **Env:** `SUPABASE_URL` (your PostgREST endpoint) + `POSTGREST_DIRECT=1` + `SUPABASE_SERVICE_ROLE_KEY`
  (HS256 `service_role` JWT, server-only) + `STORAGE_LOCAL_DIR` + `SITE_URL`/`AUTH_URL` + `AUTH_*` +
  `AUTHORIZED_EMAIL` + `CRON_SECRET`. `SUPABASE_*` keep the name because the data layer uses `supabase-js`
  (a PostgREST client) — NOT a Supabase cloud project. MCP enabled + tokenized from the admin (no `MCP_TOKEN`
  env); optional `MCP_OAUTH_SECRET` signs OAuth codes (falls back to `AUTH_SECRET`). `db.ts` strips the
  `/rest/v1` prefix when `POSTGREST_DIRECT=1` so supabase-js hits a bare PostgREST unchanged; DB password +
  JWT secret + service key come from `scripts/docker/gen-keys.mjs`, roles/grants from `docker/initdb/`.
  **Native:** `.env.example` + `docs/self-host-native.md`. **Docker:** `.env.docker.example` (bundles
  Postgres + PostgREST + local store + cron). Build needs no backend env (data layer degrades to empty).
  **Boot:** `src/instrumentation.ts` runs `validateEnv()` (`src/env.ts`) at server start (NOT build/edge)
  and fails fast on missing required vars. **Upgrades:** `scripts/migrate.sh` applies pending
  `scripts/migrations/*.sql` tracked in `schema_migrations` (Docker runs it as a one-shot; fresh installs
  seed the ledger from `schema.sql`). **Probe:** `GET /api/health` (DB + store writable).
- **Edge:** put a CDN/reverse proxy (e.g. Cloudflare) in front for global caching + TLS/HSTS; OG runs on
  the edge runtime (so its bundled font loads). Detail → `docs/seo-pwa.md`.

## Invariants — load-bearing, do not break

Each is *Enforced at* code + pinned by a *Test* or static *Guard* — all run by `npm run check:all`.

1. **Revalidate is a SUPERSET — never under-purge.** Every admin write goes through ONE place,
   `lib/revalidate.ts`; each helper runs `freshenData()` (`revalidateTag('db')`) THEN a
   `revalidatePath` superset of what the change touches. *Enforced at:* `lib/revalidate.ts`.
   *Test:* `lib/revalidate.test.ts`.
2. **Posts + pages share ONE `/{slug}` namespace.** Every create/rename calls `ensureSlugFree`
   → 409 `SlugConflictError` on collision (trashed rows still reserve their slug).
   *Enforced at:* `lib/slugs.ts`. *Test:* `lib/slugs.test.ts`.
3. **Image refs are stored store-relative.** `collapseBlob` strips the `/uploads` prefix on WRITE,
   `expandBlob` re-adds it on READ — applied in the data layer only (posts/pages/settings), so stored
   bytes carry no origin. *Enforced at:* `lib/blob.ts` + the data-layer files. *Test:* `lib/blob.test.ts`.
4. **Every write/delete route calls `requireOwner()` first.** `src/middleware.ts` is the edge
   defence-in-depth net (blocks `/admin` + owner-only `/api`); a NEW public/bearer route must be
   added to `isPublicApi()` or it 401s. *Enforced at:* `lib/api.ts` + `src/middleware.ts`.
   *Guard:* `check:routes` (static presence) + the middleware net; no integration test.
5. **Raw HTML in markdown is escaped, never executed.** `html` renderer → `escapeHtml`; `safeHref` drops
   `javascript:`/`data:`/`vbscript:`. *Enforced at:* `PostContent.tsx`. *Test:* `post-content.test.ts`.
6. **Every delete is a soft delete.** `deleteX()` sets `deleted_at`; EVERY live read filters
   `.is('deleted_at', null)` via `liveOnly()` (`db.ts`) — predicate defined ONCE; Trash reads the
   complement. *Enforced at:* data-layer files + `docs/features.md`. *Test:* `lib/soft-delete.test.ts`.
7. **Cache-bust is asymmetric.** Out-of-band writes (`backup_state`) MUST `revalidateTag(DB_TAG)`; MCP
   token routes MUST NOT (`force-no-store`; busting `db` over-purges public). *Enforced at:*
   `lib/backup-state.ts` vs `api/mcp/tokens`. *Test:* `check:token-bust` (backup side = coarse tripwire).

> **Accepted risk — no drift check (2C):** `scripts/schema.sql` is hand-maintained, the app never runs
> it. Any table/RPC/index change MUST update it in the SAME commit — review-enforced (live diff declined).

## DEBUG ROUTER — when you hit a symptom, read THESE files first

| Symptom / area | Read these first | Read more if needed |
|---|---|---|
| Image: upload / variant / responsive | `lib/media.ts`, `lib/blob.ts` (+ `lib/blob-local.ts`, `app/uploads/[...path]`), `lib/upload-client.ts`, `api/media/*`, `components/blog/PostContent.tsx` | `lib/media-usage.ts` |
| Cache / stale / content not updating / ISR | `lib/revalidate.ts`, `lib/db.ts`, `lib/posts.ts` | ARCHITECTURE "Request flow" |
| Auth / route 401 / route exposed | `lib/auth.ts` (+ `lib/auth-shared.ts` = edge-safe `isAuthorized`), `lib/api.ts`, `src/middleware.ts` (JWT via `getToken`, NO db), `api/<route>/route.ts` | `docs/mcp.md` if MCP |
| Slug / 404 / duplicate URL | `lib/slugs.ts`, `src/app/(blog)/[slug]` | `lib/posts.ts`, `lib/pages.ts` |
| Trash / soft delete / restore | `lib/posts.ts` (`deleted_at`), `api/trash`, `src/app/admin/trash` | `docs/features.md` |
| Comments (reader) / not showing / cache | `lib/comments.ts`, `components/blog/Comments.tsx`, `api/comments`, `lib/comment-md.ts` | `docs/features.md` "Comments" |
| Backup / restore / cron | `docs/backups.md`, `lib/backup.ts`, `lib/gdrive.ts`, `lib/backup-state.ts` | — |
| Theme / palette / dark / FOUC | `lib/themes.ts`, `src/components/theme/*` | `docs/conventions.md` |
| Typography / font / layout drift | `docs/conventions.md` FIRST, then the component | — |
| Search / ToC / related / preview | `lib/posts.ts`, `api/search`, `components/blog/PostContent.tsx` | `docs/features.md` |
| SEO / sitemap / feed / robots / OG | `docs/seo-pwa.md`, `src/app/{robots,sitemap,llms.txt,feed.xml,og}` | `lib/og.ts` |
| PWA / manifest / favicon | `docs/seo-pwa.md`, `src/app/manifest.ts`, `src/app/layout.tsx` | — |
| MCP server | `docs/mcp.md`, `src/lib/mcp/*`, `src/app/api/mcp/*` | — |
| WordPress import | `lib/wordpress-import.ts` (pure WXR→posts/pages), `api/import/wordpress`, `components/admin/ImportFields.tsx` | `docs/features.md` |
| Health / env / migrations / rate-limit | `api/health`, `src/env.ts` + `src/instrumentation.ts`, `scripts/migrate.sh` + `scripts/schema.sql` (`schema_migrations`), `lib/rate-limit.ts` | `docs/self-host-native.md` |

## Data layer map — `src/lib/`

Terse role per file; the authoritative detail is the code comments.

| File | Key exports | Role |
|---|---|---|
| `db.ts` | `db()` | Server-only `service_role` client; GET reads cache-eligible + tagged `db`, writes `no-store`. ALL text access goes through here |
| `blob.ts` | `blobUrl`, `uploadFile`, `readBlob`, `deleteByUrl/Pathname`, `listBlobs`, `blobOrigin`, `collapseBlob`, `expandBlob` | Binaries only; facade over the LOCAL fs driver `blob-local.ts` (served at `/uploads` via `app/uploads/[...path]`), lazy-loaded so `node:fs` stays off the client. `collapse/expand` = store-relative refs. No cloud storage SDK anywhere in `src` (`check:no-direct-blob`) |
| `posts.ts` | `getIndex`, `getPublicPosts`, `getPost`, `savePost`, `deletePost`, `getCategories`, `getTags`, `updateTerm` | Reads `React.cache()` only. `savePost` snapshots prior version + stores `readingMinutes`. `updateTerm` renames (merges on collision) / removes a term across EVERY post |
| `pages.ts` | `getPageIndex`, `getPublicPages`, `getPage`, `savePage`, `deletePage` | Mirrors `posts.ts` |
| `revisions.ts` | `getRevisions`, `pushRevision`, `renameRevisions`, `deleteRevisions` | Last 3 overwritten versions/slug (`post_revisions` jsonb, store-relative). Re-slugged on rename, removed on delete |
| `media.ts` | `getMedia`, `addMedia*`, `registerMediaBatch`, `deleteMedia*`, `finalizeContentMedia`, `finalizePendingVariants/Thumbs` | Metadata in `media`, binaries on Blob. Browser→Blob direct upload then `register` (reads dims, makes `-thumb.webp`). Heavy `-1024/-1600` AVIF+WebP deferred via `after()`, cron-swept. Delete removes EVERY version. `PostContent` emits `<picture>` only when variants exist |
| `files.ts` | `renderLogo`, `uploadIcon`, `uploadFont`, `getFiles`, `addFilesBatch`, `deleteFile*`, `getSiteIcons` | `files/` prefix = custom font, site icons (`favicon-`/`app-icon-`), attachment library. `deleteFile*` refuse `favicon-`/`app-icon-` |
| `settings.ts` | `getSettings`, `saveSettings`, `DEFAULT_SETTINGS`, `resolveAppIcon`, `typographyToCss`, `fontToCss` | `React.cache()` only. Holds `themes` + `typography` + `customFont`; migrates legacy shapes; image/font urls store-relative |
| `themes.ts` | `THEME_PRESETS`, `themesToCss`, `paletteOptions`, … | 6 owner-customizable palettes. `themesToCss` emits EVERY palette's vars. Add one = append to `THEME_PRESETS` |
| `comments.ts` / `comment-md.ts` | `getCommentTree`, `buildCommentTree`, `addComment`, `countsByPosts`, `renderCommentMarkdown` | Text-only reader comments (off by default). Public tree excludes email, tombstones deleted-but-replied, re-roots orphans. `comment-md` = bold/italic-only, escape-first. Client island fetches no-store → instant, no revalidate |
| `integration-keys.ts` / `comment-env.ts` | `getIntegrationKeys`, `getIntegrationStatus`, `saveIntegrationKeys`, `getCommentEnv` | SERVER-ONLY Turnstile secrets in `integration_keys` table (env fallback), set in admin — like `backup_state`, NEVER in `settings.data`. `getCommentEnv` (async) = which comment integrations are usable + public site key |
| `analytics.ts` | `recordView`, `recordScroll`, `getAnalytics`, `getViewTotals`, `isBot` | Cookieless; `visitor` = salted hash of IP+UA (no PII); bots + admin/api + owner skipped. Kept FOREVER |
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
| `rate-limit.ts` | `rateLimited`, `clientIp` | Shared in-memory per-IP sliding window; applied to public `track`/`search`/`mcp/register` (generous limits) |
| others | `video.ts`, `paginate.ts`, `i18n.ts`, `admin-i18n.ts`, `og.ts`, `preview.ts`, `upload-client.ts`, `utils.ts` (`slugify`/`deriveExcerpt`/`escapeHtml`/`isPublicallyVisible`) | Pure/shared helpers |

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
- **DO NOT** set Supabase GET reads to `no-store` (kills ISR) or enable `cacheComponents: true`; keep every write going through `revalidate.ts`.

## Rendering — `src/app/(blog)/[slug]/page.tsx`

- `revalidate = 3600` + `generateStaticParams` (all slugs) + `dynamicParams`. Reads `getPost` +
  `getPage` (shared `/{slug}` namespace) + `getMedia` (the `<picture>` set). Admin `/admin/*` +
  search/preview/og are dynamic.
- **Taxonomy URLs use the SLUGIFIED term** (`lib/taxonomy.ts`): links call `termSlug(term)`, the
  `category|tag/[slug]` routes call `resolveTerm(...)` → `notFound()` if none. New taxonomy
  link/route MUST go through these (never hand-encode the name).

## Conventions (HARD RULES)

- Max 400 lines per file. No `any` (use `unknown` + narrowing). Every API handler: time + log the
  request, try/catch with logged errors; only `AUTHORIZED_EMAIL` reaches `/admin`; all write/delete
  routes owner-gated server-side via `requireOwner()` (Invariant 4).
- **Public UI colours come ONLY from theme tokens** — never hardcode `neutral-*`/`white`/`black`/a
  hex. **ONE typeface + NO hardcoded sizes everywhere** (`grep -rE "font-mono|text-\[" src` and
  public `text-(sm|lg|xl…)` must stay clean). **One divider style** (the global `<hr>`); never
  ALL-CAPS in shipped UI. Repeated chrome shares ONE class constant. *Full detail →
  `docs/conventions.md`* (typography, header alignment, layout, divider).
- UI text → `src/locales/` only, all 6 languages in sync (en default, vi/de/ja/zh/ko). Code /
  comments / identifiers / filenames / commits → English. No hardcoded Vietnamese in `lib/` or
  `api/` (components only). *Add-a-language / add-a-string steps → `docs/conventions.md`.*
- **On any behaviour change, update the matching doc in the SAME change** (Working principle #3):
  CLAUDE.md (rules), the relevant `docs/*`, ARCHITECTURE.md (why), CHANGELOG.md, README.md (versioning
  + release steps → `docs/conventions.md`).
- **Do NOT read CHANGELOG.md while coding/debugging** — it's append-only at release time; its history
  is never needed to fix or understand code.

## Per-area docs (`docs/`)

Read on demand — the DEBUG ROUTER routes to each: `conventions` (typography, header align, layout,
i18n, scripts, releases) · `features` (Trash, search/ToC/related, editor, dashboards, settings) ·
`seo-pwa` (SEO, feeds, OG, region, PWA) · `mcp` (server, tokens, OAuth) · `backups` (Drive, cron).

## Next.js 16

`params`/`searchParams` are async; use `PageProps<…>`/`RouteContext<…>`. DB-read cache rules → Caching
(`no-store` + `cacheComponents:true` forbidden). Unfamiliar API → read `node_modules/next/dist/docs/` (`AGENTS.md`).
