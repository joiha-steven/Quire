@AGENTS.md

# vibeblog — operating notes

Public, open-source blog platform. **Zero personal data in this repo.** Real
credentials live only in the gitignored `.env.local` and on Vercel (`vercel env
pull`); never commit them. Personal/instance facts are not tracked in git.

> **Companion doc — don't duplicate it here.** [`ARCHITECTURE.md`](./ARCHITECTURE.md) =
> the mental model + the *why* behind decisions. This file = operational rules,
> gotchas/traps, and the per-area map. When they'd overlap, the *why* lives there, the
> *rule* lives here. The DB schema is [`scripts/schema.sql`](./scripts/schema.sql).

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
update the matching docs in the SAME change (see "Docs & releases") — that's part of the
request, not scope creep.

**4. Goal-driven execution — define success criteria, then loop until verified.** Recast a
task as something checkable ("add validation" → "invalid inputs are rejected, each path
exercised"; "fix the bug" → "I can reproduce it, then it's gone"). For multi-step work,
state a brief plan with a verify step each. **There is NO automated test suite here** —
verification = `npm run build` AND `npm run lint` both exit 0 (strict `tsc`, no `any`) +
reasoning through / manually exercising the real behavior (a route, a render, a PageSpeed
run), and the `audit/` procedure for a release/feature batch. "It compiles" is necessary,
not sufficient — confirm behavior, and report failures honestly with their output.

## Architecture (operational)

- **Text in Supabase Postgres; binaries in Vercel Blob.** Tables (schema `public`):
  `posts` `pages` `post_revisions` `media` `files` `settings` `activity_log`
  `analytics_events` `analytics_scroll` — full DDL in `scripts/schema.sql`; data-model
  shapes + the *why* in ARCHITECTURE.md.
- Writes are atomic upserts/deletes (no read-modify-write manifest); reads always fresh +
  transactional.
- `src/lib` = data layer (`db.ts` Postgres, `blob.ts` binaries); `src/app/api` = thin
  owner-gated handlers; UI in `src/components`.
- **Env:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (secret, server-only) + the Blob
  token — `.env.local` + Vercel only. The MCP server is enabled + tokenized from the admin (no
  `MCP_TOKEN` env); optional `MCP_OAUTH_SECRET` signs OAuth codes (falls back to `AUTH_SECRET`).

## Blob — `src/lib/blob.ts` (BINARIES ONLY)

Exports: `blobUrl`, `uploadFile`, `deleteByUrl`, `deleteByPathname`, `listBlobs`,
`blobOrigin`, `collapseBlob`, `expandBlob`. (Text I/O moved to Postgres — there is no
`readJson/readText/writeText` or `?ts` cache-bust anymore.)

- **Never call `list()`/`resolveUrl` to find a URL.** URLs are deterministic:
  `blobUrl(pathname)` builds them from the token (`vercel_blob_rw_<storeId>_<secret>` →
  `https://<storeId>.public.blob.vercel-storage.com/<pathname>`).
- **Stored content is store-relative.** `collapseBlob` strips the host → pathname on WRITE;
  `expandBlob` re-adds the current store base on READ. Applied in the data layer only
  (posts/pages/settings), so UI keeps absolute URLs while stored bytes carry no storeId.
  Both idempotent; external URLs untouched; old absolute content still renders and
  self-heals on next save. (Migration rationale → ARCHITECTURE.md.)
- **No vanity media domain** (removed v0.9.13): public media serves straight from the Blob
  store host; there is NO `mediaBaseUrl` setting or `BLOB_PUBLIC_BASE` env.

## Region (latency)

`vercel.json` pins functions to **`sin1` (Singapore)**; the Blob store is in Singapore
too (co-located reads, no cross-region hop). The OG route is `runtime = 'edge'`. (Self-host:
change/remove `regions` for your audience — see README.)

## Caching — ISR pages + tagged DB reads, purge on save — READ THIS

Two coordinated layers, both invalidated on every write so an edit is never stale:

- **Page** (Full Route Cache / ISR): public pages export `revalidate = 3600`; `/[slug]`
  also has `generateStaticParams` → prerendered.
- **Supabase reads** (Data Cache): `db.ts` makes GET reads cache-eligible
  (`next: { revalidate: 3600, tags: ['db'] }`) so a page that reads them stays static/ISR.
  Writes are `no-store`.

**Every admin write goes through ONE place — `src/lib/revalidate.ts`** — and each helper
begins with `freshenData()` = `revalidateTag('db')` (next render reads CURRENT Postgres)
THEN a `revalidatePath` SUPERSET (which pages re-render):
- `revalidateNewPost()` — all list/taxonomy surfaces (home, `/page/[n]`,
  `/category|tag/[slug]`(+`/page/[n]`), `feed.xml`, `sitemap.xml`, `llms.txt`).
- `revalidatePost(slug, prevSlug?)` — its own page (old+new slug) + the list surfaces.
- `revalidatePage(slug, prevSlug?)` — its own URL(s) + `sitemap.xml`/`llms.txt`.
- `revalidateEverything()` — settings / taxonomy / media-delete / "Clear all cache"
  (settings + Clear also `warmCache()`). Media *upload* alone purges nothing.

Other rules:
- Admin forms `router.refresh()` after save; admin routes are `force-dynamic` (their DB
  reads become `no-store` → editor/media/settings always live).
- **GOTCHA — owner-only API LIST routes fetched from a client component MUST export
  `dynamic = 'force-dynamic'`.** They are NOT under the `/admin` layout, so without it
  their `db()` GET reads stay Data-Cache-eligible (tag `db`, 1h) and the client list shows
  STALE rows after a mutation (this caused "deleting an MCP token does nothing" — the
  cached list kept showing a deleted id). Applies to `api/mcp/tokens`, `api/files`,
  `api/media`, `api/media/unused`, `api/posts/[slug]/revisions`. Token CRUD intentionally
  does NOT `revalidateTag('db')` (that would over-purge public pages) — `force-dynamic` is
  the right tool: live admin read, zero public-cache impact.
- `experimental.staleTimes: { dynamic: 0, static: 30 }` (Next 16 rejects `static: 0`).
- **Accepted staleness:** the "related posts" box on OTHER posts (≤1h ISR / next save).
- **DO NOT** set the Supabase GET reads to `cache: 'no-store'` (forces every page dynamic,
  kills ISR), and **do not** enable `cacheComponents: true`. Keep every write going through
  `revalidate.ts`.

## Rendering — `src/app/(blog)/[slug]/page.tsx`

- `revalidate = 3600` + `generateStaticParams` (all slugs) + `dynamicParams`. Reads
  `getPost` + `getPage` (shared `/{slug}` namespace) + `getMedia` (the `<picture>` set).
- Admin `/admin/*` is `force-dynamic`; search/preview/og are dynamic.
- **Pagination is path-based:** page 1 at the bare path, deeper at `/page/[n]`
  (+`/category|tag/[slug]/page/[n]`) — no `?query`. `parsePathPage` returns a page only for
  `n >= 2` (else `null` → 404). Shared `components/blog/BlogListing` renders all six routes.
- List entries carry `readingMinutes` (computed at save) so lists need no bodies.

## Data layer map — `src/lib/`

Terse role per file; the authoritative detail is the code comments. Gotchas that are rules
are called out elsewhere (Caching, Typography, Conventions).

| File | Key exports | Role |
|---|---|---|
| `db.ts` | `db()` | Server-only `service_role` client; GET reads cache-eligible + tagged `db`, writes `no-store`. ALL text access goes through here |
| `blob.ts` | (see Blob above) | Binaries only; deterministic URLs, never `list()` to read |
| `posts.ts` | `getIndex`, `getPublicPosts`, `getPost`, `savePost`, `deletePost`, `getCategories`, `getTags`, `updateTerm` | Reads `React.cache()` only. `savePost` snapshots the prior version (`revisions.ts`) + stores `readingMinutes`. `updateTerm` renames (merges on collision) / removes a term across EVERY post |
| `pages.ts` | `getPageIndex`, `getPublicPages`, `getPage`, `savePage`, `deletePage` | Mirrors `posts.ts` |
| `revisions.ts` | `getRevisions`, `pushRevision`, `renameRevisions`, `deleteRevisions` | Last 3 overwritten versions/slug (`post_revisions` jsonb, store-relative). Re-slugged on rename, removed on delete |
| `media.ts` | `getMedia`, `addMedia*`, `registerMediaBatch`, `deleteMedia*`, `finalizeContentMedia`, `finalizePendingVariants`, `finalizePendingThumbs` | Metadata in `media`, binaries on Blob. **Browser→Blob direct upload** (`/api/media/blob-token`) then `register` (reads dims, makes `-thumb.webp`) — dodges the 4.5MB function-body limit. Keeps untouched ORIGINAL + thumb; heavy `-1024`/`-1600` AVIF+WebP **deferred** (`finalizeContentMedia` via `after()`, cron-swept). Delete removes EVERY version. `PostContent` emits `<picture>` only when variants exist; body `<img>` carry intrinsic `width`/`height` (CLS-free), first eager + `fetchpriority=high` (LCP), rest lazy |
| `files.ts` | `renderLogo`, `uploadIcon`, `uploadFont`, `getFiles`, `addFilesBatch`, `deleteFile`, `deleteFilesBatch`, `getSiteIcons` | The `files/` prefix holds 3 NON-grid things: custom font (`font-<weight>-<ms>`), site icons (`favicon-`/`app-icon-`, accept `.ico`), and the Files attachment library (table rows). `renderLogo` → see Header. `deleteFile*` refuse `favicon-`/`app-icon-` |
| `settings.ts` | `getSettings`, `saveSettings`, `DEFAULT_SETTINGS`, `resolveAppIcon`, `typographyToCss`, `fontToCss` | `getSettings` `React.cache()` only. Holds the `themes` map + `typography` + `customFont`; migrates legacy shapes; image/font urls store-relative at rest. `resolveAppIcon` = appIcon → favicon → `/app-icon.png` |
| `themes.ts` | `THEME_PRESETS`, `themesToCss`, `paletteOptions`, … | 6 owner-customizable palettes (Mono/Sepia/Forest/Ocean/Rose/Amber). `themesToCss` emits EVERY palette's vars. Add one = append to `THEME_PRESETS` (names not localized) |
| `analytics.ts` | `recordView`, `recordScroll`, `getAnalytics`, `getViewTotals`, `isBot` | Cookieless (`analytics_events` + `analytics_scroll`). `visitor` = salted (`AUTH_SECRET`) hash of IP+UA — **no PII**; bots + admin/api + the **owner's own** visits skipped. `getAnalytics` → `analytics_summary` RPC; `getViewTotals` → `analytics_totals`. Kept FOREVER. Beacons `Track.tsx` (every page) + `ScrollDepth.tsx` (posts) fire after hydration (pages stay SSG) |
| `activity.ts` | `logActivity`, `getActivity`, `clearActivity` | `activity_log`; gated by `features.activityLog`, never throws; called via `after()` from every mutating route |
| `media-usage.ts` | `findUnusedMedia` | Read-only audit (scans posts/pages/settings + revision snapshots); badges orphans, never deletes |
| `highlight.ts` | `highlightCode` | Server-side Shiki (Vitesse dual-theme); zero client JS; null on failure → caller keeps the plain block |
| `auth.ts` | `handlers`, `auth`, `signIn`, `signOut`, `isAuthorized`, `getAuthState` | Anyone signs in; only `AUTHORIZED_EMAIL` is authorized |
| `slugs.ts` | `ensureSlugFree`, `SlugConflictError` | Posts + pages share the namespace → 409 on collision |
| `revalidate.ts` | `revalidateNewPost/Post/Page/Everything`, `warmCache` | Single source of cache invalidation (see Caching) |
| `api.ts` | `ok`, `fail`, `logRequest`, `logError`, `requireOwner` | Every route calls `requireOwner()` first |
| others | `video.ts` (YT/Vimeo/TikTok embeds), `paginate.ts`, `i18n.ts` (`t`/`formatDate`), `admin-i18n.ts`, `utils.ts` (`slugify`/`deriveExcerpt`/`isPublicallyVisible` = published && date past /…) | Pure/shared helpers |

## Trash (soft delete) — Admin → Trash (`/admin/trash`)

- **Every delete is a soft delete.** `posts`/`pages`/`media`/`files` each have a nullable
  `deleted_at` (NULL = live, timestamp = trashed). `deleteX()` sets `deleted_at`; nothing is
  hard-deleted on a normal delete. EVERY live read filters `.is('deleted_at', null)`
  (index/search/getPost, page index/getPage, media/file lists, the finalize sweeps) so trashed
  items leave the site, lists, search, sitemap/feed/llms and the libraries at once.
- **Media/file soft delete KEEPS the blob** — a published post linking a trashed image keeps
  rendering; the blob is removed only on purge. So `/api/media/delete` no longer purges the page
  cache (it used to). A trashed row **keeps its slug** (still reserved via `ensureSlugFree`) so
  restore never collides.
- Per kind the lib exports `restoreX`, `purgeX` (hard delete: row + revisions/blobs),
  `getTrashedX`, `emptyXTrash`. The Trash page server-loads all four lists; `TrashView` (4 tabs)
  acts via **`POST /api/trash`** `{ kind, action: restore|purge|empty, ids? }` (owner-gated) then
  `router.refresh()`. **Nothing auto-purges** — permanent removal is manual (per-item or Empty
  trash). Restores revalidate the item's surfaces; media/file purges `revalidateEverything()`.
- Adding a mutating trash action → log it (activity actions `*.restore` / `*.purge` /
  `trash.empty`) and keep the i18n keys in sync.

## MCP server — `/api/mcp` + `src/lib/mcp/`

- **What it is.** A remote MCP endpoint (Streamable HTTP, `mcp-handler` + `@modelcontextprotocol/sdk`)
  that lets an MCP client (Claude/ChatGPT) operate the blog. Tools are THIN wrappers over the same
  `lib/` functions the admin routes use — same slug rules, revisions, soft-delete, revalidation,
  activity log. **Off unless the owner enables it** (Admin → Settings → Advanced toggle,
  `settings.mcp.enabled`); `verifyMcpToken` 401s every call while off.
- **Auth = admin-managed tokens + thin OAuth.** Manual tokens are created in the admin (up to 5,
  named, shown ONCE on creation — only the SHA-256 hash is kept in the `mcp_tokens` table; see
  `lib/mcp/tokens.ts`). Every token **expires 180 days after creation** (`expires_at`, set on insert,
  default in `schema.sql`); `verifyMcpToken` hashes the bearer, looks it up, **rejects it once past
  `expires_at`**, else stamps `last_used_at` (while the toggle is on). There is **no `MCP_TOKEN` env
  var.** Connectors that require OAuth run a minimal OAuth 2.1 authorization-code + PKCE flow gated by
  the owner's NextAuth login (`src/app/api/mcp/{authorize,token,register}` + `src/app/.well-known/oauth-*`);
  the `/token` exchange **mints a 180-day token via `mintOAuthToken`** (named "OAuth connector") and
  returns it. **OAuth tokens are exempt from the manual 5-cap and are NEVER auto-deleted** (an expired
  row lingers as dead until the owner deletes it; a connector silently re-authorizes to mint a fresh one).
  **Lifecycle rule: the admin is the SOLE authority over a connection** — beyond the 180-day expiry a
  token persists (no prune) until the OWNER deletes it in the admin; deleting the connector in Claude
  alone just lets it re-authorize (a new token). So authorize once = stays connected (connector
  re-auths across the 180-day boundary), and an admin delete is final unless the owner re-authorizes.
  (A reconnect mints a new row; the prior one persists until the owner removes it — the admin
  lists/deletes them all.) Codes are HMAC-signed
  (`MCP_OAUTH_SECRET` → falls back to `AUTH_SECRET`) in `lib/mcp/auth.ts`. Token CRUD: owner-only
  `/api/mcp/tokens` (+ `/[id]`); UI in `components/admin/McpFields.tsx` (cap counts manual only).
- **Tools** (`lib/mcp/tools.ts` posts/pages/taxonomy, `tools-library.ts` media/files/settings;
  results via `result.ts`). Content is Markdown verbatim — no HTML conversion. Deletes are soft
  (→ Trash). **`update_settings` exposes only a safe allowlist (title/description/showDescription)** —
  the zod inputSchema IS the allowlist, so sensitive settings can't be written over MCP. `get_settings`
  reads all. **Adding a tool that mutates → revalidate + `logActivity` like the admin routes.**

## Localization — `src/locales/` (RULES)

- `types.ts` = shapes (`Dict` public, `AdminStrings` admin). Add a key → every locale file
  must define it (`satisfies` → build error otherwise = the no-missing-keys guarantee).
- `langs.ts` = `SITE_LANGS` + `isSiteLang`. Public `src/locales/<code>.ts`, admin
  `src/locales/admin/<code>.ts`. Supported: **en (default), vi, de, ja, zh, ko** (CJK via
  `system-ui` fallback — Inter has no CJK glyphs).
- **Add a language:** extend `SiteLang`, add a `SITE_LANGS` row + a `DATE_LOCALE` entry in
  `i18n.ts` + both locale files.
- **Add/rename a string:** add to `types.ts`, then fill ALL locale files. Build fails until
  complete. **Keep every locale in sync on any UI string change.**

## Scripts — `scripts/`

`node --env-file=.env.local scripts/<name>.mjs [--dry]` — idempotent.

- **`schema.sql`** — full Postgres schema (9 tables + indexes + `posts.search` tsvector +
  RLS + the analytics RPCs). Run ONCE on a fresh Supabase project. NOT run by the app;
  transcribed from the live schema — **keep it in sync when you change tables/RPCs.**
- **`migrate-to-supabase.mjs`** — one-off P1.5 migration (Blob `_index.json`+`.md` →
  Postgres). Already run; kept for recovery.
- **`scripts/legacy/` — pre-Supabase one-offs, do NOT run against the live site** (they operate
  on the retired Blob `_index.json`/`.md` model): `import-wordpress`, `convert-html-to-markdown`,
  `fix-import-captions`, `backfill-excerpts`, `rehost-images`, `rebuild-index`, `wipe-media`,
  `backfill-reading-time`, `list-posts-with-images`, `check-image-links`,
  `backfill-media-dimensions`, `remap-original-images`. Kept for recovery only; their deps
  (`gray-matter`/`turndown`/`turndown-plugin-gfm`/`fast-xml-parser`) are devDependencies.

## SEO (toggleable, Admin → Settings → SEO)

- `settings.seo` = `{ autoSchema, sitemap, llms, robots, rss, ogImage, ogFallbackImage }` +
  `settings.siteUrl` (canonical; '' → `VERCEL_PROJECT_PRODUCTION_URL` → localhost via
  `resolveSiteUrl()`). Drives `metadataBase`.
- `robots.ts` — always disallows `/admin`+`/api`; when on, a 3-group policy: search +
  reputable AI bots allowed (`SEARCH_BOTS`/`AI_BOTS`, paired with `/llms.txt`), scrapers
  (`BAD_BOTS`: Ahrefs/Semrush/…) `Disallow: /`, `*` welcoming. Lists are consts atop the file.
- `sitemap.ts` — home + posts + pages + categories + tags; each post lists its images
  (`<image:image>`). `sitemaps.xml` → 308 to `/sitemap.xml`.
- `llms.txt` (markdown content index, 404 off) · `feed.xml` (RSS 50, 404 off, auto-discovered).
- `og/route.tsx` — dynamic OG (1200×630, **edge**, Inter `.woff` subsets bundled); query
  `title`/`site`/`bg` + optional `?font=<blobUrl>` (Blob host only, SSRF-guarded). `lib/og.ts`
  builds the card URLs (`ogImageUrl` posts/pages, `ogCardUrl`+`siteDomain` lists); honors
  `seo.ogImage`; appends `font=` when a custom font is set.
- JSON-LD via `JsonLd.tsx` (`websiteSchema` home, `articleSchema` posts), gated `seo.autoSchema`.
- robots/sitemap/feed/llms are ISR; an SEO toggle is a settings save → `revalidateEverything()`;
  post create/edit purges feed/sitemap/llms.

## Reading & discovery

- Features `{ search, toc, related, readingTime, progressBar, activityLog }` (default on,
  Admin → Settings → Tính năng); gated in header / `/search` / post page.
- `/search` — **two layers:** a lean local index (`{slug,title,date,terms}`, instant +
  accent-insensitive) merged with `GET /api/search?q=` (Postgres FTS over title + BODY via
  `searchPosts` `.textSearch('search', …, {config:'simple'})`). **NOTE:** `simple` is accent-
  *sensitive* — accent-insensitivity comes from the local layer only. Header search =
  `SearchOverlay` (modal); the `/search` route stays for deep links / no-JS.
- Post page: `ReadingProgress`, `BackToTop`, `Toc` (≥3 H2/H3; desktop-only, sticky in the
  left gutter; `PostContent` assigns slug ids), `RelatedPosts` (`getRelatedPosts`: shared
  tags ×2 + categories).
- **GOTCHA:** the global unlayered `hr { margin:0 }` beats Tailwind margin utilities — put
  divider spacing on a wrapper div, not on the `<hr>`.
- **Heading ids are de-duped** (2nd `foo` → `foo-2`): `dedupeHeadingIds` (PostContent) and
  `extractHeadings` (utils) run the SAME counter over H2/H3 in document order — change one, change
  both or the ToC anchors break.
- **Link hrefs are sanitized** (`safeHref` in PostContent drops `javascript:`/`data:`/`vbscript:`)
  — marked v5+ no longer does. Raw HTML in markdown is already escaped (the `html` renderer →
  `escapeHtml`), so `<script>`/`<img onerror>` render as visible text.
- **Draft preview:** `/preview/[slug]?key=<hmac>` (force-dynamic, noindex);
  `previewToken` = HMAC(slug, `AUTH_SECRET`); editor "Link nháp" button. Separate route keeps
  `/[slug]` SSG + published-only.

## Editor (Admin → editor) — `components/admin/Editor.tsx`

- StarterKit + underline, inline code, bullet/numbered/**task** lists (GFM `- [ ]`), quote,
  code block, hr, link, captioned image, GFM tables, video. `tiptap-markdown` serializes all.
  **GOTCHA:** list items wrap content in `<p>`; `.prose li > p{margin:0}` keeps them tight.
- Autosave every 60s while dirty (chained behind any in-flight save); warns on unload.
- Time machine: each overwrite snapshots the prior version (`revisions.ts`, keeps 3); restore
  loads it into the editor (non-destructive — current version is snapshotted on next save).

## Content dashboard (Admin → content)

- 3 tabs: Bài viết / Trang / Phân loại; "new" hidden on taxonomy.
- `RowActions` (shared): open-in-new (PUBLISHED only) + edit + delete; exports the `ICON_BTN`
  chrome for reuse. `StatusPill` never wraps.
- Tables are mobile-responsive by **hiding secondary columns** (not horizontal scroll): posts
  hide Date (`sm`) + Categories (`md`); pages hide slug (`sm`). Title + Status + actions always show.
- `PostsTable` filter bar: substring search + All/Published/Draft (client-side).
- `TaxonomyManager`: rename (merge) / remove terms across all posts → `updateTerm`.

## Activity log + System panel (Admin)

- **Activity log:** every mutating route does `after(() => logActivity(action, detail))`
  (post/page CRUD, media/file/icon/font, settings, taxonomy, cache.clear). Gated by
  `features.activityLog`. Admin → Log (force-dynamic, latest 200, Clear). **Adding a mutating
  route → log it too.**
- **System panel** (admin Overview, `getSystemInfo()`): hosting/URL/region/env/git + database
  (Supabase, live reachability) + Blob host; rows may deep-link.
- **Analytics:** Admin → Analytics (24h/7d/30d/1y); a View column on the content tables
  (`getViewTotals`). Detail in the data-layer map (`analytics.ts`).

## Settings (Admin → settings) — `SettingsView.tsx`

- **ONE form, ONE save button, THREE tabs** (`general | appearance | advanced`; tab state not
  persisted). One `useState<SiteSettings>` → one PUT `/api/settings`.
- Controlled field groups (no own state/save): General `SiteFields`/`LayoutMenuFields`/
  `FeatureFields`/`SeoFields`; Appearance `ThemeFields`/`FontUpload`/`TypographyFields`/
  `AdvancedFields` (font smoothing = "Text rendering"); Advanced `McpFields` + custom-CSS.
  `McpFields` is the EXCEPTION to "no own state/save": the MCP enable toggle flows through the
  settings form, but its token manager has its own `/api/mcp/tokens` API (plaintext shown once).
- Each tab: `grid lg:grid-cols-2 items-start` (explicit columns, NOT CSS `columns`).
- **Save calls `router.refresh()`** so the admin shell + public header reflect the change
  immediately.

## Header (public) — alignment is a HARD RULE

- Logo + the icon row share ONE flex line (`items-center`) so icons stay on the logo's
  vertical midline; the description sits below.
- **The logo is auto-sized, never the raw original.** `settings.logoUrl` = the owner's
  untouched source; the header renders `settings.logoRenderUrl` (small WebP scaled to
  `logoWidth` @2x for retina, built on save by `renderLogo` in `files.ts`), falling back to
  the original only for vector/animated logos. The `<img>` carries `width`+`height`
  (`logoRenderHeight`) → no CLS. `saveSettings` regenerates on source/width change and deletes
  the old derived file (one ever exists). PageSpeed image-delivery fix.
- Icons are one set: 20px, viewBox 24, stroke 1.8, round caps.
- Theme default = **system** (no-FOUC script + `ThemeProvider` both `|| 'system'`); the toggle
  reflects the *applied* theme (`useSyncExternalStore` on `<html>.dark`; server snapshot =
  light → no hydration mismatch).
- Two orthogonal axes: **mode** (`.dark`) × **palette** (`data-palette`). `PaletteToggle` /
  `ThemeToggle` write localStorage + the attribute; the no-FOUC script applies before paint;
  all palettes' vars are emitted once. (Mechanism rationale → ARCHITECTURE.md.)

## Typography — one source of truth (HARD RULES)

- **No hardcoded text sizes on the public site.** 9 roles (`TypeRole`: `h1–h5`, `body`,
  `small`, `caption`, `code`), each with size/line-height/letter-spacing → CSS vars
  `--fs/--lh/--ls-<role>`. Defaults baked into `globals.css :root` and mirrored by
  `DEFAULT_TYPOGRAPHY` in `lib/themes.ts`. The owner's `settings.typography` is emitted by
  `typographyToCss()` into the root layout AFTER `globals.css` (also applies in the admin
  editor `.prose` = WYSIWYG). `smoothing` adds `-webkit-font-smoothing` on `body`.
- **Where applied:** `.prose` (h1–h5/pre/code/figcaption/table) read the role vars; titles/UI
  OUTSIDE `.prose` use `.fs-h1…fs-h5` + `.t-small` (every secondary text). H1 = single
  post/page titles + category/tag headings + draft preview; list cards (`PostCard`) = H2. Only
  fixed public sizes allowed: the brand wordmark + the 404 numeral.
- **Inter is self-hosted** (`public/fonts/inter-{latin,latin-ext,vietnamese}.woff2`,
  variable, declared via `@font-face` + `unicode-range` in `globals.css`; `--font-inter:'Inter'`
  there). **No `next/font/google`** — it fetched at build, which broke offline/CI builds. The OG
  route self-hosts the same Inter separately as `.woff` (Satori can't decode woff2). To update
  Inter, re-drop the woff2 files. The latin subset is `<link rel=preload>`-ed in the root layout.
- **ONE typeface for EVERYTHING — hard rule, no exceptions (incl. admin + OG).** No
  `font-family`, no `font-mono`, no second family; `.prose code` is `inherit`;
  **`grep -rE "font-mono" src` must be empty.** A custom font (`settings.customFont` =
  family + `faces[]` per weight 400/500/600/700, uploaded via `FontUpload` → `/api/files/font`,
  Blob `files/font-<weight>-<ms>`, store-relative) overrides `--font-sans` (Inter fallback) —
  one `@font-face` per weight because faux-bold is disabled (`font-synthesis-weight: none`).
  `/og` renders Inter + the custom font (`lib/og.ts` `?font=`). Empty = bundled Inter.
- **Admin chrome does NOT follow the reader's type settings** — it uses Tailwind's standard
  scale (a fixed design scale); only the admin editor `.prose` mirrors the reader. Don't wire
  admin chrome to `--fs-*`.
- Editor exposes H1–H5; `marked` renders `####`/`#####` → `h4`/`h5`.

## PWA

- Installs to the home screen, launches standalone. **No service worker (offline is out of
  scope by design)** → nothing to register; admin/API are never cached.
- `app/manifest.ts` (force-dynamic) from settings (name/short_name = title, theme/bg = light
  palette bg, icons via `resolveAppIcon`). Next auto-injects `<link rel="manifest">` — don't
  add it by hand.
- iOS home-screen icon = the **apple-touch-icon** (`generateMetadata` in `app/layout.tsx`);
  standalone via the manifest's `display:standalone` (iOS 16.4+). Status bar via
  `generateViewport` → `themeColor`.
- App icon order: `appIconUrl` → `faviconUrl` → bundled `public/app-icon.png`.
- **Favicon: ONE `<link rel="icon">`, driven only by `generateMetadata`** (`settings.faviconUrl ||
  '/favicon.ico'`). The default lives in **`public/favicon.ico`, NOT `app/`** — an `app/favicon.ico`
  is auto-injected by Next ON TOP of the metadata icon, which shipped two conflicting favicons.
  Don't re-add `app/favicon.ico`.

## Conventions (HARD RULES)

- **Repeated chrome shares ONE class constant — never hand-roll per element.** Sibling controls
  import the same string so they can't drift. Admin nav is a **collapsible left sidebar**
  (`AdminSidebar.tsx`): each item has an icon (`navIcons.tsx`) + label; a toggle collapses the rail
  to icon-only (persisted in localStorage; it publishes its width as `--admin-nav-w` so the fixed
  settings/editor save bars offset past it). Every item — nav links AND theme/palette/cache/sign-out
  controls — uses `headerActions.ts` `SIDEBAR_NAV` (active links add `SIDEBAR_NAV_ACTIVE`); on mobile
  it's a hamburger drawer (always icon+label). (`ADMIN_NAV` is the older horizontal variant.)
  Public header's 40px icon buttons → `ICON_BTN` (`ui/iconButton.ts`). Adding an item = reuse the
  constant, never copy a class list.
- **Header/menu alignment must be pixel-exact — the owner is very sensitive and it has drifted
  repeatedly.** Every header-row item (incl. the bigger brand wordmark) is an
  `inline-flex h-9 items-center` box; the row is `items-center`. NEVER align a bigger wordmark
  by `items-baseline` (the recurring bug); never leave an item without the `h-9` box. Verify the
  rendered result before shipping.
- **One divider style site-wide:** the global `<hr>` (50% width, left, faint). Never bespoke
  `border-t`/`border-b` as content dividers; never ALL-CAPS (no `uppercase`) in shipped UI.
- **Public UI colours come ONLY from theme tokens — never hardcode `neutral-*`/`white`/`black`
  or a hex.** Vars `--c-bg/text/heading/meta/link/rule` are utilities (`bg-bg`, `text-text`,
  `text-heading`, `text-meta`, `text-link`, `border-rule`). Every line/border + faint surface
  (code blocks, hovers, banners) uses `--c-rule`. Admin tooling may stay neutral.
- **ONE font + NO hardcoded sizes — everywhere (see Typography).**
  `grep -rE "font-mono|text-\[" src` and public `text-(sm|lg|xl…)` must stay clean.
- UI text → `src/locales/` only, all languages in sync (see Localization). Code / comments /
  identifiers / filenames / commits → English. No hardcoded Vietnamese in `lib/` or `api/`
  (components only).
- Max 400 lines per file. No `any` (use `unknown` + narrowing).
- Every API handler: time + log the request, try/catch with logged errors. Auth: only
  `AUTHORIZED_EMAIL` reaches `/admin`; all write/delete routes are owner-gated server-side (401)
  via `requireOwner()`. **`src/middleware.ts` is the edge defense-in-depth net** — it reads the
  NextAuth JWT and blocks `/admin/:path*` (→ sign-in) and owner-only `/api/:path*` (→ 401) even if a
  new route forgets `requireOwner()`. It **allow-lists self-authed/public paths** (`/api/auth`,
  `/api/cron`, `/api/track`, `/api/search`, `/api/mcp` except `/api/mcp/tokens`) — a NEW public or
  bearer/secret-authed API route must be added to `isPublicApi()` there or it gets 401'd. Google is
  the ONLY sign-in provider.

## Next.js 16

- `params`/`searchParams` are async (await them). Use `PageProps<…>`/`RouteContext<…>` helpers.
- **DO NOT** set the Supabase GET reads to `no-store`; **avoid** `cacheComponents: true` (PPR —
  incompatible with `Date.now()` + route configs). See Caching.
- Before writing any unfamiliar API, read `node_modules/next/dist/docs/` (see `AGENTS.md` —
  Next 16 differs from training data).

## Docs & releases — keep current

On any behavior change, update the matching doc in the SAME change (Working principle #3):
- **CLAUDE.md** (this) = rules / data-layer / caching / gotchas. **ARCHITECTURE.md** = overview
  + why. **CHANGELOG.md** = one entry per user-facing change. **CHECKLIST.md** = pre-deploy
  steps. **README.md** = setup + features. **ROADMAP.md** = direction.
- Keep personal/instance values (credentials, Vercel/Blob IDs, the live domain) OUT of tracked
  files — `.env.local` + Vercel only.
- **Audits** (`audit/`): a full review per `audit/README.md` → dated `audit/YYYY-MM-DD-<scope>.md`;
  read the latest first so a pass starts from the last clean line.
- **Versioning (owner's rule — do NOT auto-bump):** the version is **`1.0.x`** (was `0.9.x`; the
  owner cut **1.0.0** with the MCP + Trash release). Each change bumps the patch `x`
  (→ `1.0.999`), a running counter with no semver meaning. NEVER raise `1.0` → `1.1` or `→ 2.0`
  unless the owner asks. A code change bumps `x`; pure-docs may skip. On a bump, also update the
  **README H1** `# vibeblog (v1.0.x)`.
- **Cutting a release:** `x` already current; `npm run build` + `npm run lint` exit 0; push `main`;
  `gh release create v1.0.<x> --title "v1.0.<x> - <tagline>" --notes "…"`.
