@AGENTS.md

# vibeblog — operating notes

Public, open-source blog platform. **Zero personal data in this repo.** Real
credentials live only in the gitignored `.env.local` and on Vercel (`vercel env
pull`); never commit them. Personal/instance facts are not tracked in git.

## Architecture
- **Text content in Supabase Postgres; binaries in Vercel Blob.** (Migrated from the
  old no-DB `_index.json`+`.md`-on-Blob model — "P1.5".)
  - Postgres tables (project `vibeblog`, ap-southeast-1, schema `public`): `posts`
    (metadata cols + markdown `content` + `search` tsvector), `pages`, `post_revisions`
    (jsonb snapshot, last 3/slug), `media` (metadata), `files` (metadata), `settings`
    (single row id=1, jsonb).
  - Vercel Blob holds ONLY binaries: `media/{name}.{ext}` (original + variants + thumb)
    and `files/{...}` (attachments + favicon/app-icon).
- Writes are atomic upserts/deletes (no read-modify-write manifest → the "deleted image
  comes back" race is gone). Reads are always fresh + transactional.
- `src/lib` is the data layer: `db.ts` (server-only `service_role` Supabase client) +
  `blob.ts` (binaries only). `src/app/api` are thin route handlers; UI in `src/components`.
- **Env:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (secret, server-only) + the
  Blob token; all in gitignored `.env.local` + Vercel.

## Blob access — `src/lib/blob.ts`
> **P1.5 note:** `blob.ts` is now BINARIES-ONLY. `readJson/readText/writeJson/writeText`
> and the `?ts` cache-bust were REMOVED — text content lives in Postgres (`db.ts`).
> What remains: `uploadFile`, `deleteByUrl/deleteByPathname`, `blobUrl`, `blobOrigin`,
> `listBlobs`, `collapseBlob`/`expandBlob`/`setMediaBase`. The store-relative
> collapse/expand rules below still apply to image refs (now stored in DB columns).
- **Never call `resolveUrl` / `list()` to find a URL before reading.** URLs are
  deterministic: `blobUrl(pathname)` constructs them directly from the token.
  Token format: `vercel_blob_rw_<storeId>_<secret>` →
  `https://<storeId>.public.blob.vercel-storage.com/<pathname>`.
- **No vanity media domain (removed v0.9.13).** PUBLIC media is served straight from the Blob
  store host (`blobUrl`/`expandBlob`/`blobOrigin` all use `blobBase()`); there is NO
  `mediaBaseUrl` setting or `BLOB_PUBLIC_BASE` env, and no `setMediaBase`/`publicBase`. The old
  `files.manhhung.me` Cloudflare Worker proxy returned a restrictive CSP that broke library
  thumbnails, so it was dropped. `collapseBlob`/`expandBlob` still keep stored content
  store-relative, so moving the binary store (e.g. → R2) is still just a token/base swap.
- `uploadFile(pathname, body, contentType)` — put a binary; `deleteByPathname` removes one.
- **Stored content is store-relative, not absolute.** `collapseBlob(s)` strips the
  Blob host → pathname (`media/x.webp`) on WRITE; `expandBlob(s)` re-adds the current
  store base on READ. Applied in the data layer only (posts/pages/settings), so all
  UI keeps working with absolute URLs while stored bytes carry no storeId. This
  decouples content from the store — changing store/region/provider needs no content
  rewrite (just the token/base). Both are idempotent; external URLs are untouched.
  Old absolute-URL content still renders (expand leaves it) and self-heals on next save.

## Portability — no real vendor lock-in (migration path)
Media is **pure Vercel Blob**, but the design keeps switching providers cheap:
- **Content carries no vendor host.** Posts/pages/settings store image refs
  **store-relative** (`media/x.webp`), via `collapseBlob` on write; the host is only
   re-added at read (`expandBlob`). Changing store/region/provider needs **no content
  rewrite** — just the token/base. Files are open formats (`.md`, `.json`, plain images),
  no proprietary container.
- **Media serves from the Blob store host** (`*.public.blob.vercel-storage.com`). Image SEO is
  handled by associating images with their page (image sitemap + Article `image`), not by a
  vanity domain — see SEO below. No proxy in the path.
- **Vercel coupling is one small file.** Only `src/lib/blob.ts` calls `@vercel/blob`
  (`put`/`list`/`del`). Everything else goes through its exported helpers.
- **To migrate (e.g. → Cloudflare R2, S3-compatible):** (1) copy all objects to the new
  bucket; (2) rewrite `blob.ts`'s ~6 I/O functions to the S3 SDK (and `blobBase()` to the new
  host); swap the token env. App
  logic, content, and public URLs are untouched — a few hours, not a rewrite.

## Region (latency)
- `vercel.json` pins serverless functions to **`sin1` (Singapore)** — closest Vercel
  region to the Vietnamese audience (~40ms vs ~200ms to the default `iad1` US-East).
  Requires the Pro plan. Static assets already serve from the global edge CDN.
- The **Blob store is in Singapore** too (moved from `iad1`), so reads are co-located
  with the functions — no cross-region hop.
- The OG route is `runtime = 'edge'` and runs at the nearest PoP regardless.

## Caching model — ISR pages + tagged DB reads, purge on save — read this
TWO coordinated layers, both invalidated on every write so an edit is never served stale:

- **The page** (Next Full Route Cache / ISR): public pages export `revalidate = 3600`
  (`/`, `/[slug]`, the SEO routes; `/[slug]` also has `generateStaticParams` → prerendered
  `●`). Visitors get fast cached HTML; the 1h window is only a safety net.
- **The Supabase reads** (Next Data Cache): `db.ts` gives the client a custom fetch — GET reads
  are cache-eligible (`next: { revalidate: 3600, tags: ['db'] }`) so a page that reads them can
  still be static/ISR (a `no-store` read would force the whole route dynamic, killing the page
  cache). Every read carries the `'db'` tag (`DB_TAG`). Writes are `no-store`.

On every admin write `src/lib/revalidate.ts` does BOTH: `revalidateTag('db')` (`freshenData()`)
so the NEXT render reads CURRENT data from Postgres — never a stale Data Cache entry — AND a
`revalidatePath` SUPERSET that decides WHICH pages re-render. The tag guarantees freshness; the
paths decide what re-renders. One coarse tag = no per-key bookkeeping to drift (that drift, plus
Blob's CDN staleness, is what made the OLD no-DB `unstable_cache`+`?ts` model serve stale content).

- **All invalidation goes through `revalidate.ts`** — each admin write calls exactly one helper,
  and each helper begins with `freshenData()`:
  - **New post** → `revalidateNewPost()`: every list/taxonomy surface (home, `/page/[n]`,
    `/category/[slug]`(+`/page/[n]`), `/tag/[slug]`(+`/page/[n]`), `feed.xml`, `sitemap.xml`,
    `llms.txt`). Bracketed dynamic forms (`'page'` type) cover every slug + pagination page in
    one call. Other posts' detail pages stay warm.
  - **Edit/delete post** → `revalidatePost(slug, prevSlug?)`: its own page (old + new slug) PLUS
    all the list surfaces above.
  - **New/edit/delete page** → `revalidatePage(slug, prevSlug?)`: just its own URL(s) +
    `sitemap.xml`/`llms.txt`.
  - **Settings / taxonomy / media delete / "Clear all cache"** → `revalidateEverything()`
    (`revalidatePath('/', 'layout')`); settings + the Clear button also `warmCache()`. Media
    *upload* alone purges nothing (not on a public page until a referencing post is saved). The
    "Check unused" media audit is read-only.
  - **One accepted staleness:** the "related posts" box on OTHER posts' detail pages — won't
    reflect a newly-shared tag until that post's own ISR (≤1h) or next save. Cosmetic, self-heals;
    Clear-all is the instant full-sync escape hatch.
- **Admin forms call `router.refresh()` after a successful save** (PostForm, PageForm,
  SettingsView) so the client Router Cache is dropped. Admin routes are `force-dynamic`, so Next
  overrides their DB reads to `no-store` → the editor/media/settings always show live data.
- **Data-layer reads also use `React.cache()`** (request-scoped dedup) on top of the Data Cache.
- **Client Router Cache minimized** (`experimental.staleTimes: { dynamic: 0, static: 30 }`).
  Next 16 rejects `static: 0` (min 30), so a static route can hold a client RSC up to 30s on soft
  nav (ISR + purge-on-save still make a hard load fresh).
- **DO NOT** set the Supabase GET reads to `cache: 'no-store'` (forces every page dynamic, killing
  ISR), and **do not** enable `cacheComponents: true`. The `'db'` tag + `revalidatePath` superset
  IS the model — keep every write going through `revalidate.ts`.

## Rendering — `src/app/(blog)/[slug]/page.tsx`
- `revalidate = 3600` + `generateStaticParams` (all post/page slugs) + `dynamicParams = true`
  → known slugs prerender (`●`), new ones render on first visit, all refresh via ISR and
  purge instantly on save. Reads `getPost` + `getPage` (shared `/{slug}` namespace) +
  `getMedia` (for the `<picture>` ready-set).
- Admin (`/admin/*`) is `force-dynamic` (uncached) — the editor/media/settings always show
  current Blob state. Search/preview/og are dynamic too.
- List pages (home is ISR; category/tag/`page/[n]` are dynamic). Pagination is **path-based**: page 1 at
  the bare path, deeper pages at `/page/[n]` (and `/category/[slug]/page/[n]`,
  `/tag/[slug]/page/[n]`) — no `?query`, friendlier for SEO. `parsePathPage` returns the
  page only for `n >= 2` (else `null` → 404, so there is no duplicate URL for page 1 and
  no out-of-range pages). The shared `components/blog/BlogListing` renders all six routes.
- Post list entries carry `readingMinutes` (computed from the body in `toMeta` at save;
  `backfill-reading-time.mjs` filled existing posts) so lists show read time without
  loading bodies.

## Data layer reference — `src/lib/`

| File | Key exports | Notes |
|---|---|---|
| `db.ts` | `db()` | Server-only Supabase client (service_role). Custom fetch: GET reads cache-eligible (`next.revalidate`) for ISR, writes `no-store`. ALL text content access goes through here |
| `blob.ts` | `blobUrl`, `uploadFile`, `deleteByUrl`, `deleteByPathname`, `listBlobs`, `blobOrigin`, `collapseBlob`, `expandBlob` | BINARIES ONLY (images/files/icons). `blobUrl`/`expandBlob` use the lowercase Blob store host (no vanity domain). Never call `list()` to find a URL — use `blobUrl()`. (Text I/O moved to Postgres; `readJson/writeText/?ts/setMediaBase` removed) |
| `activity.ts` | `logActivity`, `getActivity`, `clearActivity` | Activity log (Postgres `activity_log`). `logActivity` is gated by `settings.features.activityLog` and never throws. Called via `after()` from every mutating route |
| `analytics.ts` | `recordView`, `recordScroll`, `getAnalytics`, `getViewTotals`, `isBot` | Cookieless analytics (Postgres `analytics_events` + `analytics_scroll`). `recordView` (via `POST /api/track`, in `after()`) inserts `{ path, visitor }` where `visitor` = salted (`AUTH_SECRET`) hash of IP+UA — **no PII stored**; bots + admin/api paths skipped; **owner's own visits not counted** (`/api/track` skips when `requireOwner()`). `recordScroll` stores a `{ path, depth }` sample (max % reached on leave; a missed pagehide loses a depth sample, never a view). `getAnalytics(days, bucket)` = one `analytics_summary(since, top_n, bucket)` RPC → `{ totalViews, uniqueVisitors, avgReadDepth, topPages[{path,views,visitors,avgDepth}], daily[] }` (`bucket`='hour' for the 24h range, else 'day'). `getViewTotals` = `analytics_totals` RPC → all-time `{ "/slug": n }` for the content-table View column. **Events are kept FOREVER** (no purge — owner's call). Admin UI: `/admin/analytics` (`AnalyticsView`, 24h/7d/30d/1y). Public beacons: `Track.tsx` (view, every page) + `ScrollDepth.tsx` (depth, posts only) — both client `sendBeacon`, fire after hydration so pages stay SSG |
| `posts.ts` | `getIndex`, `getPublicPosts`, `getPost`, `savePost`, `deletePost`, `getCategories`, `getTags`, `updateTerm` | Reads are `React.cache()` only (request-scoped dedup, never cross-request). `savePost` snapshots the about-to-be-overwritten version via `revisions.ts` (time machine), and stores `readingMinutes` in the index. `updateTerm(kind, name, newName\|null)` renames (merges on collision) or removes a category/tag across EVERY post — updates each affected post's array column (no body rewrite), no revision snapshot; drives the Phân loại tab (`POST /api/taxonomy`, owner-only, → `revalidateEverything`) |
| `revisions.ts` | `getRevisions`, `pushRevision`, `renameRevisions`, `deleteRevisions` | Last 3 overwritten versions per post in the `post_revisions` table (jsonb snapshot, store-relative; newest first). Drives the editor "time machine". Re-slugged on slug change, removed on delete |
| `pages.ts` | `getPageIndex`, `getPublicPages`, `getPage`, `savePage`, `deletePage` | Mirrors posts.ts; reads are `React.cache()` only |
| `settings.ts` | `getSettings`, `saveSettings`, `DEFAULT_SETTINGS`, `resolveAppIcon`, `typographyToCss`, `fontToCss` (re-exports `DEFAULT_THEME`, `themesToCss`, `getDefaultTheme`, `DEFAULT_TYPOGRAPHY`, `DEFAULT_FONT`) | `getSettings` = `React.cache()` only. Holds the per-palette `themes` map, the per-role `typography`, and the uploaded `customFont` (`{ family, faces[] }`, see Typography below); migrates a legacy single `theme` into the default palette on read, and the old flat typography / single-url font shapes forward. Font face urls are store-relative at rest. `resolveAppIcon(s)` = appIcon → favicon → `/app-icon.png` for the PWA |
| `themes.ts` | `THEME_PRESETS`, `DEFAULT_THEME`, `DEFAULT_PRESET_ID`, `getPreset`, `isPresetId`, `cloneTheme`, `defaultThemes`, `getDefaultTheme`, `themesToCss`, `paletteOptions` | The 6 built-in palettes (Mono/Sepia/Forest/Ocean/Rose/Amber), each a full light+dark `ThemeSettings`. **Each is independently owner-customizable** — colors live in `settings.themes` (id→ThemeSettings); `settings.themePreset` = the visitor default. `themesToCss(themes, defaultId)` emits CSS for EVERY palette (default on `:root`/`.dark`, others under `[data-palette="id"]` + `[data-palette].dark`) so the client `PaletteToggle` swaps instantly via `<html data-palette>`. Add a palette by appending to `THEME_PRESETS` (names are constant proper nouns, not localized) |
| `files.ts` | `uploadIcon`, `isAllowedIconType`, `uploadFont`, `isAllowedFontType`, `getFiles`, `addFilesBatch`, `deleteFile`, `deleteFilesBatch`, `getSiteIcons` | Three things share the `files/` Blob prefix: (0) the **custom font** (`uploadFont(name, weight, …)` → `files/font-<weight>-<ms>.<ext>`, `.woff2/.woff/.ttf/.otf`; one per weight; NOT a table row, hidden from the grid; `POST /api/files/font`); (1) **site icons** (favicon, app icon) via `uploadIcon`, accepting `.ico`, kept OUT of the media grid (NOT table rows); (2) the **Files library** — non-image attachments (PDF/zip/docx/audio…) whose metadata lives in the `files` table (binaries on Blob). `deleteFile`/`deleteFilesBatch` refuse `favicon-`/`app-icon-`. `getSiteIcons` lists the icon blobs (uploadedAt parsed from the `<kind>-<ms>` filename) so the Files tab can show them read-only (tagged "Settings"). `registerFilesBatch` records metadata for files the browser uploaded straight to Blob. Routes: `GET /api/files`, `POST /api/files/blob-token` + `POST /api/files/register` (client direct upload), `DELETE /api/files/by?url=`, `POST /api/files/delete` (multi), `GET /api/files/icons`, plus the icon-only `POST /api/files/upload`. Admin UI: `LibraryTabs` (Images = `MediaLibrary` · Files = `FileLibrary` + `FileUploader`); both grids have multi-select delete. `expandBlob` round-trips `files/` like `media/` |
| `media.ts` | `getMedia`, `addMedia`, `addMediaBatch`, `registerMediaBatch`, `deleteMedia`/`deleteMediaBatch`, `finalizeContentMedia`, `finalizePendingVariants`, `finalizePendingThumbs` | Metadata in the `media` table; binaries on Blob. **Uploads go straight from the browser to Blob** (`POST /api/media/blob-token` issues an owner-gated client token → the file never passes through a function, so the serverless 4.5MB request-body limit can't fail large photos), then `POST /api/media/register` (`registerMediaBatch`) fetches the original back to read dimensions + make the `-thumb.webp` and inserts the row. Upload keeps the untouched ORIGINAL + a cheap `-thumb.webp`; heavy `-1024`/`-1600` AVIF+WebP are **deferred** off the save request (`finalizeContentMedia` via `after()`, swept by cron). Delete removes EVERY version (original + thumb + all variants), atomic row delete (no resurrection race). `finalizePendingThumbs` backfills thumbs for rows that lack one (migration imports). `PostContent` emits `<picture>` only for originals whose variants exist; others render a plain `<img>` so a missing variant never blanks the image. Body `<img>` carry intrinsic `width`/`height` from the row (CLS-free); the FIRST body image is eager + `fetchpriority=high` (LCP), the rest lazy |
| `highlight.ts` | `highlightCode` | Server-side Shiki syntax highlighting (singleton highlighter, Vitesse light+dark dual-theme, curated lang set). Called by `PostContent.highlightBlocks` to replace marked's plain `<pre><code class="language-x">` blocks; returns null on failure → caller keeps the plain block. Dark tokens swap via `.dark .shiki` CSS (`!important`, beats Shiki's inline light colors). Zero client JS |
| `media-usage.ts` | `findUnusedMedia` | **Read-only audit** — returns URLs of media referenced by no post/page/settings **or revision snapshot** (the "Check unused" library button, `GET /api/media/unused`). Flags orphans in the grid for manual review; never deletes. Scans revisions on purpose so a time-machine restore's image is never reported as unused (the old destructive `sweep.ts` missed revisions and could delete a still-needed image) |
| `auth.ts` | `handlers`, `auth`, `signIn`, `signOut`, `isAuthorized`, `getAuthState` | Anyone can sign in; only `AUTHORIZED_EMAIL` is authorized; unauthorized = silently redirected |
| `slugs.ts` | `ensureSlugFree`, `SlugConflictError` | Posts + pages share the same URL namespace; throws `SlugConflictError` (→ 409) on collision |
| `video.ts` | `videoEmbed`, `isVideoUrl` | Recognizes YouTube / Vimeo / TikTok URLs; returns embed URL. Videos stored as plain URLs in Markdown |
| `paginate.ts` | `paginate`, `parsePage` | Pure helper; `parsePage` converts `searchParams.page` → number |
| `i18n.ts` | `t(lang)`, `formatDate` | Thin loader over `src/locales/`; `formatDate` uses Intl per-lang (vi custom) |
| `utils.ts` | `slugify`, `deriveExcerpt`, `clampExcerpt`, `isPublicallyVisible`, `formatBytes`, `formatDateVi`, `formatDateTimeShort`, `formatTime` | `isPublicallyVisible` = `status === 'published'` AND date is past |
| `api.ts` | `ok`, `fail`, `logRequest`, `logError`, `requireOwner` | Shared API helpers. Every route must call `requireOwner()` first |
| `revalidate.ts` | `revalidateNewPost`, `revalidatePost`, `revalidatePage`, `revalidateEverything`, `warmCache` | **Single source of truth for cache invalidation.** Every admin write calls exactly one helper; each is a superset of the affected surfaces (never under-purges). See "Caching model" |
| `admin-i18n.ts` | `adminT(lang)` | Thin loader over `src/locales/admin/` |

### Localization — `src/locales/`
- `types.ts` = shapes (`Dict` public, `AdminStrings` admin). Add a key here → every
  locale file must define it (`satisfies` makes TS error otherwise — that is the
  "no missing keys" guarantee).
- `langs.ts` = single source of truth: `SITE_LANGS` (picker), `isSiteLang` (validation).
- Public strings: `src/locales/<code>.ts`. Admin strings: `src/locales/admin/<code>.ts`.
- Supported: **en (default), vi, de, ja, zh, ko**. CJK renders via the `system-ui`
  font fallback (Inter has no CJK glyphs) — intentional, keeps the bundle light.
- **Add a language**: extend `SiteLang`, add a `SITE_LANGS` row, a `DATE_LOCALE` entry
  in `i18n.ts`, and create both locale files. TS enforces completeness.
- **Add/rename a string**: add the key to `types.ts`, then fill it in ALL locale files
  (both public + admin where relevant). Build fails until every language has it. Keep
  every locale in sync on any UI string change.

## Scripts — `scripts/`

One-off Node scripts, not part of the app. Run with `node scripts/<name>.mjs`.
> **Legacy (pre-Supabase):** every script below except `migrate-to-supabase.mjs` operates on the
> retired Blob `_index.json` + `.md` model and no longer reflects the live data layer. Kept only
> as historical reference / recovery for the old store; do NOT run them against the current site.

| Script | Purpose |
|---|---|
| `migrate-to-supabase.mjs` | One-off P1.5 migration: read all Blob `_index.json` + `.md` + revisions → insert into Postgres (posts/pages/revisions/media/files/settings). Idempotent (upsert), `--dry` to preview. Already run; kept for reference/recovery |
| `import-wordpress.mjs` | Import WP XML export → Blob posts |
| `convert-html-to-markdown.mjs` | Convert WP HTML body → Markdown |
| `fix-import-captions.mjs` | Fold `<figcaption>` into image `alt` |
| `backfill-excerpts.mjs` | Auto-fill missing excerpts from body |
| `rehost-images.mjs` | Re-upload external image URLs to Blob |
| `rebuild-index.mjs` | Rebuild `posts/_index.json` + `media/_index.json` from Blob files (recovery tool) |
| `wipe-media.mjs` | Delete every media blob except the in-use logo. Dry-run by default; `--apply` to delete (backs up the media index locally first) |
| `backfill-reading-time.mjs` | Fill `readingMinutes` on existing `posts/_index.json` entries (new saves compute it automatically). Idempotent; `--dry` to preview |
| `list-posts-with-images.mjs` | Read-only report of which posts reference images (to re-upload originals by hand) |
| `check-image-links.mjs` | Read-only audit: HEAD-check every image ref (body media + featuredImage, Blob + external) across all posts; reports broken links |
| `backfill-media-dimensions.mjs` | Fill `width`/`height` on `media/_index.json` entries that lack them by decoding each original with sharp (new uploads already store dims). Additive + idempotent; backs up the index, `--apply` to write |
| `remap-original-images.mjs` | Recover broken `media/...` refs by fetching the ORIGINAL full-size files from the source WP site via the Rocket.net file API (`ROCKET_TOKEN`+`ROCKET_SITE` env, needs `/tmp/uploads-index.json`); strips `-WxH` suffixes, uploads to Blob, rewrites markdown. `--apply` to write |

## SEO (toggleable in Admin → Settings → SEO)
- `settings.seo` = `{ autoSchema, sitemap, llms, robots, rss, ogImage, ogFallbackImage }`
  (booleans default true; `ogFallbackImage` '') + `settings.siteUrl` (canonical base;
  '' → `VERCEL_PROJECT_PRODUCTION_URL` → localhost, via `resolveSiteUrl()`). Drives
  `metadataBase` and every absolute URL below.
- `app/robots.ts` → robots.txt (always disallows `/admin` + `/api`; advertises the
  sitemap when robots + sitemap are on). When robots is on it emits a 3-group policy:
  major search engines + reputable AI bots (`SEARCH_BOTS`/`AI_BOTS`, paired with
  `/llms.txt`) are allowed; aggressive SEO/data scrapers (`BAD_BOTS`: Ahrefs, Semrush,
  MJ12, DotBot, PetalBot, Bytespider…) get `Disallow: /`; `*` stays welcoming so unknown
  good bots work. Lists are consts at the top of the file — edit there to add/remove a bot.
- `app/sitemap.ts` → sitemap.xml (home + posts + pages + categories + tags). Each post entry
  also lists its images (`<image:image>`, via `images:` on the entry) — featured image + every
  body image (`extractImageUrls`) — so search engines associate images with their manhhung.me
  page even though the files are on the Blob host. (`BlogPosting` JSON-LD on the post carries an
  `image` too: featured, else first body image.)
  `app/sitemaps.xml/route.ts` → 308 alias to `/sitemap.xml` (for the plural form / old submissions).
- `app/llms.txt/route.ts` → /llms.txt, a Markdown content index for AI crawlers
  (llmstxt.org); 404 when off.
- `app/feed.xml/route.ts` → RSS 2.0 (latest 50 posts); 404 when off; auto-discovered
  via root metadata `alternates`.
- `app/og/route.tsx` → dynamic OG image (1200×630, **edge runtime**, Be Vietnam Pro
  TTFs bundled beside it and loaded via `fetch(new URL('./x.ttf', import.meta.url))`).
  Fully query-driven (`title`/`site`/`bg`, both length-capped), no Blob read.
  `lib/og.ts` builds the card URL for every surface (all honor the `seo.ogImage`
  toggle; bg = the relevant image or `seo.ogFallbackImage` → gradient):
  - `ogImageUrl` — posts/pages: top = title, bottom = site title; bg = featured image.
  - `ogCardUrl` + `siteDomain` — list surfaces: **home** (top = domain, bottom =
    description), **category/tag** (top = name, bottom = domain). Wired into each
    route's `generateMetadata`.
- JSON-LD via `components/blog/JsonLd.tsx` (`websiteSchema` on home, `articleSchema`
  on posts), gated by `seo.autoSchema`.
- robots/sitemap/feed/llms are ISR (`revalidate = 3600`), not force-dynamic. Toggling an SEO
  feature is a settings save → `revalidateEverything()` purges them; a post create/edit also
  purges feed/sitemap/llms via `revalidate.ts` so new posts appear in them promptly.

## Reading & discovery
- All reader features are toggleable: `settings.features { search, toc, related,
  readingTime, progressBar, activityLog }` (default on, Admin → Settings → Tính năng). Gated in
  the header (search icon), `/search` (notFound when off), and the post page. `activityLog` is
  the one admin-facing toggle in this bucket — it gates the activity log, not a reader feature.
- `/search` — **two layers merged.** The server ships a LEAN pre-folded index (`{ slug, title,
  date, terms }`, terms = folded title+tags+categories, no excerpt/image so it scales);
  `SearchClient` filters it in memory for instant, accent-insensitive title/tag hits. In
  parallel it debounce-calls `GET /api/search?q=` which runs a Postgres full-text query over
  title + BODY (`searchPosts` → `.textSearch('search', q, { type:'websearch', config:'simple' })`
  on the generated `search` tsvector); body-only hits are appended after the local ones. Caps at
  50. The API honours the same `features.search` gate. NOTE: `config:'simple'` is accent-
  *sensitive* (no `unaccent` in the generated column) — accent-insensitivity comes from the local
  layer only.
  - **Header search opens an OVERLAY, not a page nav** (`SearchTrigger` → `SearchOverlay`): the
    same two-layer model in a modal (Escape / backdrop to close), fetching the lean index once
    from `GET /api/search/index` on open. The `/search` route still exists for deep links / no-JS.
- Post pages: `ReadingProgress` (top bar), `BackToTop` (scroll-to-top button, fades in past the
  first viewport; aria-label `t().backToTop`), `Toc` (>= 3 H2/H3; **desktop-only**, a `sticky`
  nav inside an `absolute` full-height track in the left gutter so it starts level with the
  body and follows the scroll; the `PostContent` renderer assigns slug ids to H2/H3),
  `RelatedPosts`. NOTE: the global unlayered `hr { margin:0 }` beats Tailwind margin
  utilities, so put divider spacing on a wrapper div, not on the `<hr>` itself.
  (`getRelatedPosts` — shared tags ×2 + categories), and `readingMinutes` in the meta.
- **Draft preview**: `/preview/[slug]?key=<hmac>` (force-dynamic, noindex) renders any
  status when the key matches `previewToken(slug)` (HMAC of slug keyed by AUTH_SECRET).
  Owner route `GET /api/preview-link?slug=`; editor has a "Link nháp" copy button. Kept
  separate from `/[slug]` so the public route stays SSG and only shows published posts.
- `@vercel/analytics` `<Analytics/>` in the root layout (enable Web Analytics in the
  Vercel project dashboard to collect data). `(blog)/not-found.tsx` = themed 404.
- Public reads degrade to fallback instead of 500: `blob.ts` `readJson`/`readText`
  return the fallback/null on any error (missing token, Blob down) rather than rethrow.

## Editor (Admin → editor)
- **Nodes/marks** (`components/admin/Editor.tsx`): StarterKit + underline, inline code, bullet/
  numbered/**task** lists (`@tiptap/extension-task-list`+`-task-item`; GFM `- [ ]`, `marked`
  renders the checkboxes on the public side), quote, code block, hr, link, captioned image,
  GFM tables, video. **Placeholder** ext drives the empty-state hint (the CSS reads its
  `data-placeholder`/`is-editor-empty`). `tiptap-markdown` serializes it all (incl. task items).
  List items: TipTap/`marked` wrap content in `<p>`; `.prose li > p{margin:0}` keeps them tight.
- **Autosave**: `PostForm` saves every 60s while `dirty` (chained behind any in-flight
  save so autosave + manual save never race). Also warns on unload with unsaved changes.
- **Time machine**: each overwrite snapshots the prior version (`revisions.ts`, keeps 3).
  Editor action bar → "Cỗ máy thời gian" lists them (`GET /api/posts/[slug]/revisions`);
  "Khôi phục" loads a revision into the editor (slug + date stay current) and marks dirty —
  non-destructive, the current version is snapshotted on the next save. `EditorApi.setMarkdown`
  reloads the TipTap doc.

## Content dashboard (Admin → content)
- `ContentDashboard` has three tabs: **Bài viết** (posts), **Trang** (pages), **Phân loại**
  (taxonomy). The "new" button is hidden on the taxonomy tab. The tab row is `flex-wrap` for
  mobile.
- **Row actions** (`RowActions`, shared by both tables): open-in-new-tab (only for PUBLISHED
  items → public `/{slug}`, drafts would 404) + edit + delete. Icons + `ICON_BTN` chrome are
  exported there so other lists reuse the exact look. `StatusPill` never wraps.
- **Tables are mobile-responsive by hiding secondary columns**, not horizontal scroll: posts
  hide Date (`sm`) + Categories (`md`); pages hide the slug (`sm`). Title + Status + actions
  always show, so the status pill never gets squeezed into wrapping on a phone.
- **`PostsTable` has a filter bar**: a folded substring search box (title/tags/categories) + an
  All/Published/Draft segmented control, both client-side over the props (no fetch). Empty filter
  result shows `t.filterEmpty`. Helps find a post fast as the archive grows.
- **Phân loại tab** (`TaxonomyManager`): lists every category + tag with a usage count
  (derived client-side from the post index already in props — no extra fetch), each with
  rename (prompt; merges into an existing term) + remove (across all posts). Calls
  `updateTerm` via `POST /api/taxonomy`, then `router.refresh()`.

## Activity log + System panel (Admin)
- **Activity log** (`lib/activity.ts`, Postgres `activity_log`): every mutating route records
  one entry via `after(() => logActivity(action, detail))` AFTER the response (never slows the
  action, never throws). Actions: `post|page.{create,update,delete}`, `media.{upload,delete}`,
  `file.{add,delete}`, `icon.upload`, `font.upload`, `settings.save`, `taxonomy.update`, `cache.clear`.
  Gated by `settings.features.activityLog` (default on). Viewed at **Admin → Log**
  (`/admin/log`, force-dynamic) — newest first + a Clear button (`DELETE /api/activity`);
  `GET /api/activity` returns the latest 200. When adding a new mutating route, log it too.
- **System panel** (admin Overview): `getSystemInfo()` in `app/admin/page.tsx` reports hosting
  (Vercel), the live URL (`VERCEL_PROJECT_PRODUCTION_URL`), `VERCEL_REGION`/`VERCEL_ENV`, branch +
  commit (`VERCEL_GIT_COMMIT_REF`/`_SHA`), framework + Node runtime, the database (Supabase · ref
  from `SUPABASE_URL`) with a live reachability check, and the Blob host (`blobOrigin()`). Each row
  may carry an optional `href` → `SystemCard` renders the value as a deep link (Vercel dashboard,
  Blob stores, the Supabase project, the GitHub commit via `VERCEL_GIT_REPO_OWNER`/`_SLUG`).
- **Analytics** (`/admin/analytics`): see the `analytics.ts` row in the data-layer table. Cookieless,
  Postgres-backed; events are kept forever (no retention purge). A View column on the content
  tables (`/admin/content`) shows each post/page's all-time total (`getViewTotals`).

## Settings (Admin → settings)
- **One form, one save button, THREE tabs** (`SettingsView.tsx`): all settings live in a single
  `useState<SiteSettings>`, saved together via one PUT `/api/settings` (sticky bottom bar). A
  local `tab` state (`general | appearance | advanced`) switches which cards render — it is NOT
  persisted. Controlled field groups (no own state/save): `SiteFields`, `LayoutMenuFields`,
  `FeatureFields`, `SeoFields` (General); `ThemeFields`, `FontUpload`, `TypographyFields`
  (Appearance); `AdvancedFields` + the custom-CSS textarea (Advanced) — each takes the value +
  an `update`/`onChange`.
- Each tab lays its cards in two **explicit** top-aligned columns (`grid lg:grid-cols-2
  items-start`, NOT CSS `columns`). Uniform card chrome; hint `<p>` paired with its input in a
  `space-y-1.5` wrapper (no negative-margin hacks).
- **Save calls `router.refresh()`** after a successful PUT so the server-rendered admin
  shell (nav labels, `adminT(language)`) and the public header reflect the change
  immediately — without it, e.g. switching language looked like it did nothing until reload.

## Header (public + theme)
- Logo and the icon row (search, theme, menu) share ONE flex line (`items-center`) so the
  icons stay on the logo's vertical midline at any logo size; the site description sits
  below that row. Icons are one consistent set: 20px, viewBox 24, stroke 1.8, round caps.
- Theme default is **system** (no-FOUC script + `ThemeProvider` both `|| 'system'`). The
  toggle icon reflects the *applied* theme — `useSyncExternalStore` reads the `<html>.dark`
  class (server snapshot = light, so no hydration mismatch), showing sun (light) / moon (dark).
- **Two orthogonal axes: mode (light/dark, `.dark` class) × palette (6 colors, `data-palette`).**
  `PaletteToggle` (public header = icon, admin header = palette name) is the visitor switcher —
  same pattern as `ThemeToggle`: `useSyncExternalStore` reads `<html data-palette>` (server
  snapshot = owner default → no mismatch), writes localStorage `palette` + the attribute; the
  no-FOUC script applies the stored palette before paint. All palettes' vars are emitted once by
  `themesToCss`, so switching is attribute-only. Admin chrome stays neutral by design (mode
  affects it, palette mostly affects the public reading surface).

## Typography (per-role system + font) — one source of truth
- **No hardcoded text sizes on the public site.** Every piece of reader-facing text maps to one
  of **9 roles** (`TypeRole` in `types`): `h1–h5`, `body`, `small` (dates/meta/related/ToC/
  pagination/search), `caption` (figures), `code` (mono). Each role has its own **size (rem) /
  line-height / letter-spacing (em)**, emitted as CSS vars `--fs-<role>` / `--lh-<role>` /
  `--ls-<role>`. Defaults are baked into `globals.css :root` (fresh install renders correctly)
  and mirror `DEFAULT_TYPOGRAPHY` in `lib/themes.ts` (client-safe — the settings UI imports it +
  `TYPE_ROLES` for its reset). The owner's saved values (`settings.typography = { roles, smoothing }`)
  are emitted by `typographyToCss()` into a `:root` `<style>` in the **root** layout, injected
  AFTER `globals.css` so they win (also applies inside the admin editor `.prose`, WYSIWYG).
  `smoothing` adds the `-webkit-font-smoothing: antialiased` rule on `body`.
- **Where applied:** `.prose` (+ `h1…h5`, `pre`/`code`, `figcaption`, `table`) read the role vars;
  titles/UI OUTSIDE `.prose` use the utility classes `.fs-h1…fs-h5` (titles) and `.t-small`
  (every secondary text — replaced all public `text-sm`). **H1** = single post/page titles
  (`[slug]/page.tsx`), category/tag list headings (`BlogListing` callers), draft preview; **list
  cards (`PostCard`) use H2**. Intentional one-offs left hardcoded: brand wordmark (`(blog)/layout`),
  the search input box, and the 404 numeral — display chrome, not content.
- **Custom font, per weight** (`settings.customFont = { family, faces[] }`, `faces` =
  `{ weight, url }[]` for 400/500/600/700): uploaded in Admin → Settings → Appearance via
  `FontUpload` → `POST /api/files/font?weight=` (`uploadFont` in `files.ts`), stored on Blob under
  `files/font-<weight>-<ms>.<ext>` (NOT a `files` table row → hidden from the grid). All weights
  share one `family` (derived from the first file, weight/style tokens stripped). `fontToCss()`
  emits one `@font-face` per weight + overrides `--font-sans` (Inter stays the fallback) — needed
  because the site disables faux-bold (`font-synthesis-weight: none`), so a single Regular would
  leave headings/bold thin. Face urls are store-relative at rest. Empty = bundled Inter.
- **Editor** exposes H1–H5 (StarterKit headings); `marked` renders `####`/`#####` → `h4`/`h5`.
- **Customize:** Admin → Settings is **three tabs** (General / Appearance / Advanced). Appearance:
  colors (`ThemeFields`), font (`FontUpload`, 4 weight slots), per-role text table
  (`TypographyFields` — size/line/spacing for all 9 roles, one reset). Advanced: font-smoothing
  toggle (`AdvancedFields`) + custom CSS. All saved via the single settings PUT.

## PWA (installable app)
- The site installs to the iPhone/Android home screen and launches **standalone** (full-screen,
  no browser chrome). **Installable + standalone only — no service worker (offline is out of
  scope by design),** so there is nothing to register/unregister and admin/API are never cached.
- `app/manifest.ts` (`force-dynamic`) builds the manifest from settings: `name`/`short_name` =
  title, `theme_color`/`background_color` = the light palette bg, icons from `resolveAppIcon`.
  Next auto-injects `<link rel="manifest">`; do not add it by hand.
- iOS ignores the manifest for the home-screen **icon** — it uses the **apple-touch-icon** (from
  `generateMetadata` in `app/layout.tsx`). For standalone launch, iOS 16.4+ honours the manifest's
  `display:standalone`, so no legacy `apple-mobile-web-app-capable` meta is needed (Next manages
  capability as the modern `mobile-web-app-capable` and strips the apple-prefixed variant anyway).
  The status-bar colour follows the palette per light/dark via `generateViewport` → `themeColor`.
- App icon source order: owner's `appIconUrl` → `faviconUrl` → bundled `public/app-icon.png`
  (a `vb` monogram). Owner uploads a square icon in Admin → Settings (next to the favicon).

## Conventions
- **Repeated chrome shares ONE class constant — never hand-roll per element.** A set of
  sibling controls (the admin header items, etc.) must import the same string so they cannot
  drift in height/padding/text-size/colour. Admin header: `components/admin/headerActions.ts`
  (`ADMIN_NAV`) — the SAME plain-text-link style for EVERY item: brand-adjacent nav links AND
  the right-side controls (theme toggle, clear-cache, sign-out), so the bar reads as one
  uniform set of text links, nothing styled as a button. Adding an item = reuse it, do not
  copy a class list. (`CacheButton` accepts a `className`, default `ADMIN_NAV`; `ThemeToggle`
  has a `variant='text'` that renders the applied theme as a word styled by `triggerClassName`.)
  The PUBLIC header's 40px icon buttons (search, palette, theme, menu) share `ICON_BTN`
  (`components/ui/iconButton.ts`) the same way — the toggles' `variant='icon'` uses it, and a
  new icon button must reuse it, never re-type the `h-10 w-10 … text-meta hover:bg-rule` string.
- **Header/menu alignment must be pixel-exact — the owner is very sensitive to it and it has
  drifted repeatedly.** RULE: every item on a header row (incl. the differently-sized brand
  wordmark) is a `inline-flex h-9 items-center` box, and the row is `items-center`. Same fixed
  height + centred contents = every label sits on one line regardless of font size. NEVER align
  a bigger wordmark to smaller links by `items-baseline` (that was the recurring bug) and never
  leave an item without the shared `h-9` box. Verify the rendered result before shipping.
- One divider style site-wide: the global `<hr>` (50% width, left-aligned, faint).
  Never use bespoke `border-t`/`border-b` rules as content dividers, and never ALL-CAPS
  text (no `uppercase`) anywhere in shipped UI.
- **Public UI colours come ONLY from the theme tokens — never hardcode `neutral-*`/`white`/
  `black` or a hex.** The reading-colour vars (`--c-bg/text/heading/meta/link/rule`) are exposed
  as Tailwind utilities via `@theme inline` in `globals.css`: `bg-bg`, `text-text`,
  `text-heading`, `text-meta`, `text-link`, `border-rule`. **Every line/border + every faint
  surface (code blocks, hovers, banners) uses `--c-rule`** (`border-rule` / `bg-rule` /
  `hover:bg-rule` / `ring-rule`), so one colour in Admin → Giao diện drives them all. Admin
  tooling may stay neutral; this rule is for the reader-facing `(blog)` UI.
- UI text (labels, buttons, toasts, placeholders) → never hardcoded; go through
  `src/locales/` and keep every language in sync (see Localization above).
- Code, comments, identifiers, filenames, commits → English.
- Max 400 lines per file. No `any` (use `unknown` + narrowing).
- No hardcoded Vietnamese strings in `lib/` or `api/` — components only.
- Every API handler: time + log the request, try/catch with logged errors.
- Auth: only `AUTHORIZED_EMAIL` reaches `/admin`; all write/delete routes are
  owner-gated server-side (401 otherwise).

## Next.js 16 reminders
- `params` / `searchParams` are async (await them).
- Use `PageProps<...>` / `RouteContext<...>` global type helpers.
- Reads use `React.cache()` for request-scoped dedup; the Supabase GET reads are tagged `'db'`
  + cache-eligible. Do NOT set them to `cache: 'no-store'` (forces every page dynamic). Public
  pages are ISR (`revalidate`) + purged on save (`revalidateTag('db')` + `revalidatePath`);
  admin is `force-dynamic`. See "Caching model".
- `cacheComponents: true` enables PPR — avoid (incompatible with `Date.now()` + route configs).
- Before writing any unfamiliar API, read `node_modules/next/dist/docs/`.

## Docs & releases — keep current (single repo)
This is the only repo (the former `vibeblog-private` workspace was removed). When you
change behavior, update the matching doc in the SAME change so they never drift:
- `CLAUDE.md` (this file) — architecture, data layer, caching, gotchas/traps. The
  living source of truth; update the relevant section whenever you add/alter a system.
- `ARCHITECTURE.md` — fresh-reader overview + the *why* behind decisions.
- `CHANGELOG.md` — one entry per user-facing change (Keep a Changelog style).
- `CHECKLIST.md` — pre-deploy verification steps.
- `README.md` — setup + feature summary for open-source users.
- `ROADMAP.md` — planned direction (Docker, ingest API, AI assist).

Keep personal/instance values (real credentials, Vercel/Blob IDs, the live domain)
OUT of every tracked file — they belong in the gitignored `.env.local` + Vercel only.

### Comprehensive audits (`audit/`)
A full project review (security / logic / performance / layout / docs) follows the
procedure in [`audit/README.md`](./audit/README.md) and is recorded as a dated report
`audit/YYYY-MM-DD-<scope>.md`. Run one before a release or after a feature batch; read the
latest report first so a new pass starts from the last clean line, not from scratch.

### Maintenance scripts (`scripts/`)
Load the Blob token from `.env.local`; all support `--dry`:
`node --env-file=.env.local scripts/<name>.mjs [args] [--dry]`. Idempotent
(merge by slug / skip done work). After bulk `.md` edits run `rebuild-index.mjs`.

### Versioning — owner's rule (do NOT auto-bump)
- The version line is **`0.9.x`**. Every change just **increments the patch `x`** in
  `package.json` (e.g. `0.9.1` → `0.9.2` → … up to `0.9.999`). `x` resets nothing and has
  no semver meaning here — it is a running change counter.
- **Never raise the minor/major yourself** (`0.9` → `0.10`, or `→ 1.0.0`). Bump the
  `0.9` part ONLY when the owner explicitly asks. Until then, stay on `0.9.x`.
- A change that touches code bumps `x`; pure-docs tweaks may skip it (as before).
- When you bump `x`, also update the **README H1 title** `# vibeblog (v0.9.x)` to match
  `package.json` (the title carries the version on purpose).

### Cutting a release
1. `x` is already current in `package.json` (see Versioning above — never re-bump the
   `0.9` part). `npm run build` + `npm run lint` must exit 0; push to `main`.
2. `gh release create v0.9.<x> --title "v0.9.<x> - <tagline>" --notes "..."`. The admin
   footer/Overview shows the `package.json` version so users can compare against the latest release.
