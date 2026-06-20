@AGENTS.md

# vibeblog — operating notes

Public, open-source blog platform. **Zero personal data in this repo.** Real
credentials live only in the gitignored `.env.local` and on Vercel (`vercel env
pull`); never commit them. Personal/instance facts are not tracked in git.

## Architecture
- No database. All content is in Vercel Blob.
  - `posts/_index.json` — array of post metadata (no body); the only query layer.
  - `posts/{slug}.md` — YAML frontmatter + markdown body.
  - `media/_index.json` — array of MediaItem.
  - `media/{timestamp}-{name}` — uploaded files (original name preserved).
  - `pages/_index.json` — static pages metadata.
  - `pages/{slug}.md` — static page content.
  - `settings/site.json` — site-wide settings (title, theme, menu…).
- Every write/delete updates the relevant `_index.json` (read → modify → write).
- `src/lib` is the data layer; `src/app/api` are thin route handlers; UI is in
  `src/components`.

## Blob access — `src/lib/blob.ts`
- **Never call `resolveUrl` / `list()` to find a URL before reading.** URLs are
  deterministic: `blobUrl(pathname)` constructs them directly from the token.
  Token format: `vercel_blob_rw_<storeId>_<secret>` →
  `https://<storeId>.public.blob.vercel-storage.com/<pathname>`.
- **Vanity media domain** — serve PUBLIC media from your own host (e.g.
  `https://files.manhhung.me`, a Cloudflare Worker proxying the store). Two sources, owner
  setting wins: **Settings → `mediaBaseUrl`** (Admin UI, preferred) → else env
  `BLOB_PUBLIC_BASE`. `getSettings` pushes the resolved value into `blob.ts` via
  `setMediaBase()` each request (module-scoped; process-constant for this single site).
  The data-layer reads that expand media (`posts`/`pages`/`media` `readIndex` + `getPost`/
  `getPage`/`getMedia`) `await getSettings()` FIRST so `_mediaBase` is set before any
  `expandBlob` runs — no ordering race even with the env unset (`getSettings` is `React.cache`d,
  so it is free when the layout already read settings this request).
  `publicBase()` then drives `expandBlob` (rendered `<img>`/markdown src) + `blobOrigin`
  (preconnect) ONLY — internal reads (`blobUrl`/`readJson`/`readText`) stay token-derived so
  the app never proxies its own `.md`/`_index.json` fetches (no hop, `?ts` cache-bust intact).
  `collapseBlob` strips the vanity host too, so saved content stays store-relative.
- `readJson(pathname, fallback)` — fetch JSON; returns fallback on 404/error.
- `readText(pathname)` — fetch markdown; returns null on 404/error.
- `writeJson` / `writeText` — put with `allowOverwrite: true`, `cacheControlMaxAge: 0`.
- Every read uses `fresh(url)` (adds `?ts=<now>`) to bust CDN cache on stale blobs.
- **Stored content is store-relative, not absolute.** `collapseBlob(s)` strips any
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
- **Your own domain already fronts media.** Public media serves from the vanity host
  (`mediaBaseUrl`, a Cloudflare Worker proxy), not `*.blob.vercel-storage.com`. Readers +
  Google only ever see your domain, so the backend can move without breaking live links.
- **Vercel coupling is one small file.** Only `src/lib/blob.ts` calls `@vercel/blob`
  (`put`/`list`/`del`). Everything else goes through its exported helpers.
- **To migrate (e.g. → Cloudflare R2, S3-compatible):** (1) copy all objects to the new
  bucket; (2) repoint the `files.*` Worker at it; (3) rewrite `blob.ts`'s ~6 I/O functions
  to the S3 SDK (and `blobBase()`/`publicBase()` to the new host); swap the token env. App
  logic, content, and public URLs are untouched — a few hours, not a rewrite.

## Region (latency)
- `vercel.json` pins serverless functions to **`sin1` (Singapore)** — closest Vercel
  region to the Vietnamese audience (~40ms vs ~200ms to the default `iad1` US-East).
  Requires the Pro plan. Static assets already serve from the global edge CDN.
- The **Blob store is in Singapore** too (moved from `iad1`), so reads are co-located
  with the functions — no cross-region hop.
- The OG route is `runtime = 'edge'` and runs at the nearest PoP regardless.

## Caching model — ISR pages + full purge on save — read this
ONE cache layer: the **page** (Next Full Route Cache / ISR). There is deliberately
**no data cache** (`unstable_cache`) — stacking a tagged data cache over Blob was what
repeatedly served stale content (missing posts, reappearing deleted images, settings not
applying, cross-deploy Data Cache persistence). The model now:

- **Pages are ISR-cached** with `export const revalidate = 3600` (`/`, `/[slug]`, the SEO
  routes; `/[slug]` also has `generateStaticParams` → prerendered `●`). Visitors get fast
  cached HTML; the 1h window is only a safety net.
- **All cache invalidation goes through `src/lib/revalidate.ts`** (one place, always a
  SUPERSET of the affected surfaces — never under-purges, which is what made old per-tag
  bookkeeping go stale). Each admin write calls exactly one helper:
  - **New post** → `revalidateNewPost()`: every list/taxonomy surface (home, `/page/[n]`,
    `/category/[slug]`(+`/page/[n]`), `/tag/[slug]`(+`/page/[n]`), `feed.xml`, `sitemap.xml`,
    `llms.txt`). The bracketed dynamic forms (`'page'` type) cover every slug + pagination
    page in one call. Other posts' detail pages stay warm.
  - **Edit/delete post** → `revalidatePost(slug, prevSlug?)`: the post's own page (old + new
    slug) PLUS all the list surfaces above (its title/excerpt/date/taxonomy live there too).
  - **New/edit/delete page** → `revalidatePage(slug, prevSlug?)`: just its own URL(s) +
    `sitemap.xml`/`llms.txt` (a static page never appears on post lists/taxonomy).
  - **Settings** → `revalidateEverything()` (`revalidatePath('/', 'layout')`) + `warmCache()`
    — theme/menu/title/SEO touch every page, so purge the whole site then re-warm.
  - **"Clear all cache" button** / media delete/sweep → `revalidateEverything()` (+ warm on
    the button). Media *upload* alone purges nothing (not on a public page until a referencing
    post is saved, which purges).
  - **The one accepted staleness:** the "related posts" box on OTHER post detail pages — a new
    post sharing tags with post Y won't show in Y's related list until Y's own ISR (≤1h) or
    next save. Cosmetic, self-heals; the Clear button is the instant full-sync escape hatch.
- **Admin forms call `router.refresh()` after a successful save** (PostForm, PageForm, and
  SettingsView) so the client Router Cache is dropped — the admin lists and public site show
  the save on the next navigation, not a stale RSC. The server purge above handles the Full
  Route Cache; `router.refresh()` handles the client side. (This pairs with `staleTimes` in
  `next.config.ts`; both were causes of the old "applies late" symptom.)
- **Data-layer reads use `React.cache()` only** (request-scoped dedup, never cross-request)
  AND the Blob fetch is **cache-eligible but cache-busted**: `blob.ts` reads with
  `{ next: { revalidate: 3600 } }` (NOT `no-store`, so pages can be ISR) while `fresh()`
  adds a unique `?ts=`, so every actual fetch hits the Blob origin fresh. Net: pages cache,
  but each (re)generation reads current data — no stale data cache, no read-after-write race
  (the read-modify-write in `mutateIndex` is always fresh for the same reason).
- **Why this is reliable now (vs the old `unstable_cache` model):** (1) one cache layer, not
  two; (2) the Full Route Cache is **per-deployment** — a new deploy never serves another
  deploy's stale pages (the old Data Cache persisted across deploys); (3) every save does a
  **full** purge, so nothing is missed; (4) `?ts` guarantees fresh Blob on regeneration.
- **"Clear all cache" button** (`CacheButton` → `POST /api/cache/clear`) =
  `revalidatePath('/', 'layout')` + warms the home + newest detail pages. Use it after
  editing Blob directly (outside admin) or to force a global refresh.
- **No cache-key versioning** (adding an index field needs no bump). Client Router Cache is
  minimized (`experimental.staleTimes: { dynamic: 0, static: 30 }`) so soft navigations to
  dynamic routes are always fresh. NOTE: Next 16 rejects `static: 0` (min 30) and silently
  ignores it — 30 is the lowest accepted value, so static routes can hold a client RSC up to
  30s on soft nav (ISR + the full purge-on-save still make a hard load fresh).
- **DO NOT** reintroduce `unstable_cache` or `cacheComponents: true`, and **do not** set the
  Blob reads back to `cache: 'no-store'` (that forces every page dynamic, killing the ISR
  cache). Never add a cross-request data cache over Blob — that is exactly what broke before.

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
| `blob.ts` | `blobUrl`, `readJson`, `readText`, `writeJson`, `writeText`, `uploadFile`, `deleteByUrl`, `deleteByPathname`, `listBlobs` | All Blob I/O. Never call `list()` to find a URL — use `blobUrl()` |
| `posts.ts` | `getIndex`, `getPublicPosts`, `getPost`, `savePost`, `deletePost`, `getCategories`, `getTags`, `updateTerm` | Reads are `React.cache()` only (request-scoped dedup, never cross-request). `savePost` snapshots the about-to-be-overwritten version via `revisions.ts` (time machine), and stores `readingMinutes` in the index. `updateTerm(kind, name, newName\|null)` renames (merges on collision) or removes a category/tag across EVERY post — rewrites each affected `.md` + the index in one pass, no revision snapshot; drives the Phân loại tab (`POST /api/taxonomy`, owner-only, → `revalidateEverything`) |
| `revisions.ts` | `getRevisions`, `pushRevision`, `renameRevisions`, `deleteRevisions` | Last 3 overwritten versions per post at `revisions/{slug}.json` (newest first). Drives the editor "time machine". Moved on slug change, removed on delete |
| `pages.ts` | `getPageIndex`, `getPublicPages`, `getPage`, `savePage`, `deletePage` | Mirrors posts.ts; reads are `React.cache()` only |
| `settings.ts` | `getSettings`, `saveSettings`, `DEFAULT_SETTINGS`, `DEFAULT_THEME`, `themeToCss` | `getSettings` = `React.cache()` only; `themeToCss` converts ThemeSettings → CSS vars string |
| `media.ts` | `getMedia`, `addMedia`, `addMediaBatch`, `deleteMedia`, `finalizeContentMedia` | Upload is **batched** (`addMediaBatch` = one manifest read-modify-write for all files; collision names checked against the real store via `listBlobs`). jpg/png keeps ORIGINAL + cheap `-thumb.webp` (`variants:false`); heavy `-1024`/`-1600` AVIF+WebP are **deferred** — `finalizeContentMedia` (post/page save) generates them only for images kept in the content. svg/gif/webp stored as-is. Delete removes all variants. `PostContent` emits `<picture>` **only** for originals whose variants exist (the `readyOriginals` set from `getMedia`); others render a plain `<img>` so a missing variant never blanks the image |
| `sweep.ts` | `sweepUnusedMedia` | Deletes media referenced by no post/page/settings (the "Clean unused" library button, `POST /api/media/sweep`). Clears orphans from dropped-then-discarded images |
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

| Script | Purpose |
|---|---|
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
- `app/sitemap.ts` → sitemap.xml (home + posts + pages + categories + tags).
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
  readingTime, progressBar }` (default on, Admin → Settings → Tính năng). Gated in the
  header (search icon), `/search` (notFound when off), and the post page.
- `/search` — server ships a LEAN pre-folded index (`{ slug, title, date, terms }`,
  terms = folded title+tags+categories, no excerpt/image so it scales); `SearchClient`
  lists nothing until the reader types, filters in memory, caps at 50. Header search icon.
- Post pages: `ReadingProgress` (top bar), `Toc` (>= 3 H2/H3; **desktop-only**, a `sticky`
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
- **Phân loại tab** (`TaxonomyManager`): lists every category + tag with a usage count
  (derived client-side from the post index already in props — no extra fetch), each with
  rename (prompt; merges into an existing term) + remove (across all posts). Calls
  `updateTerm` via `POST /api/taxonomy`, then `router.refresh()`.

## Settings (Admin → settings)
- **One form, one save button** (`SettingsView.tsx`): all settings live in a single
  `useState<SiteSettings>`, saved together via one PUT `/api/settings` (sticky bottom
  bar). Controlled field groups (no own state/save): `SiteFields`, `LayoutMenuFields`,
  `FeatureFields`, `ThemeFields`, `SeoFields` — each takes the value + an `update`/`onChange`.
- Layout = two **explicit** top-aligned columns (`grid lg:grid-cols-2 items-start`, NOT
  CSS `columns` — multicol drops the 2nd column down and ragged). Cards distributed to
  balance length: left = Thông tin chung + Bố cục & menu + Tính năng đọc; right = Giao diện
  + SEO. Uniform card chrome; inner spacing `space-y-5`, hint `<p>` paired with its input in
  a `space-y-1.5` wrapper (no negative-margin hacks).
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

## Conventions
- **Repeated chrome shares ONE class constant — never hand-roll per element.** A set of
  sibling controls (the admin header items, etc.) must import the same string so they cannot
  drift in height/padding/text-size/colour. Admin header: `components/admin/headerActions.ts`
  (`ADMIN_NAV`) — the SAME plain-text-link style for EVERY item: brand-adjacent nav links AND
  the right-side controls (theme toggle, clear-cache, sign-out), so the bar reads as one
  uniform set of text links, nothing styled as a button. Adding an item = reuse it, do not
  copy a class list. (`CacheButton` accepts a `className`, default `ADMIN_NAV`; `ThemeToggle`
  has a `variant='text'` that renders the applied theme as a word styled by `triggerClassName`.)
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
- Reads use `React.cache()` for request-scoped dedup; do NOT add `unstable_cache` back, and
  do NOT set Blob reads to `cache: 'no-store'` (forces every page dynamic). Public pages are
  ISR (`revalidate`) + purged on save; admin is `force-dynamic`. See "Caching model".
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

Keep personal/instance values (real credentials, Vercel/Blob IDs, the live domain)
OUT of every tracked file — they belong in the gitignored `.env.local` + Vercel only.

### Maintenance scripts (`scripts/`)
Load the Blob token from `.env.local`; all support `--dry`:
`node --env-file=.env.local scripts/<name>.mjs [args] [--dry]`. Idempotent
(merge by slug / skip done work). After bulk `.md` edits run `rebuild-index.mjs`.

### Cutting a release
1. Bump `package.json` version — semver: `0.x.0` feature batch, `0.x.y` fix/polish,
   `1.0.0` first stable. `npm run build` + `npm run lint` must exit 0; push to `main`.
2. `gh release create v<X.Y.Z> --title "v<X.Y.Z> - <tagline>" --notes "..."`. The admin
   footer shows the `package.json` version so users can compare against the latest release.
