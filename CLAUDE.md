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
- `readJson(pathname, fallback)` — fetch JSON; returns fallback on 404/error.
- `readText(pathname)` — fetch markdown; returns null on 404/error.
- `writeJson` / `writeText` — put with `allowOverwrite: true`, `cacheControlMaxAge: 0`.
- Every read uses `fresh(url)` (adds `?ts=<now>`) to bust CDN cache on stale blobs.

## Region (latency)
- `vercel.json` pins serverless functions to **`sin1` (Singapore)** — closest Vercel
  region to the Vietnamese audience (~40ms vs ~200ms to the default `iad1` US-East).
  Requires the Pro plan. Static assets already serve from the global edge CDN.
- The **Blob store is in `iad1`** (US-East), so a cold `unstable_cache` read crosses
  regions (sin1→iad1). Most reads hit the regional Data Cache, so this only bites on
  cache miss. For full co-location, create a Singapore Blob store and migrate.
- The OG route is `runtime = 'edge'` and runs at the nearest PoP regardless.

## Caching model — Previous model (no `cacheComponents`)
`cacheComponents` is NOT enabled. Uses `unstable_cache` + `React.cache()`:

Every Blob read is wrapped in `unstable_cache` with a tag, so reads are served
from the Next data cache (no Blob round-trip) until a mutation revalidates the
tag. Images are the only long-cached layer (1 year, set in `uploadFile`).

| Function | How cached | Tag |
|---|---|---|
| `getSettings()` | `unstable_cache` | `settings` |
| `getIndex()` / `getPublicPosts()` | `unstable_cache` (shared `readIndex`) | `posts` |
| `getPageIndex()` / `getPublicPages()` | `unstable_cache` (shared `readIndex`) | `pages` |
| `getPost(slug)` | `unstable_cache` (per slug) + `React.cache()` | `posts` |
| `getPage(slug)` | `unstable_cache` (per slug) + `React.cache()` | `pages` |
| `getMedia()` | `unstable_cache` | `media` |

Because `getPost`/`getPage` are now cached, `/[slug]` prerenders as **SSG** (static
HTML) and regenerates on tag/path revalidation — instant reads, fresh on edit.

- **After any post write/delete**: call `revalidateTag('posts', { expire: 0 })` +
  `revalidatePath('/new-slug')` (and old slug if it changed).
- **After settings save**: call `revalidateTag('settings', { expire: 0 })` +
  `revalidatePath('/', 'layout')`.
- **After page write/delete**: call `revalidateTag('pages', { expire: 0 })` +
  `revalidatePath('/slug')` (and old slug if changed).
- **After media upload/delete**: call `revalidateTag('media', { expire: 0 })`.
- Client Router Cache is disabled (`experimental.staleTimes: { dynamic: 0, static: 0 }`
  in `next.config.ts`) so a navigation after an edit never shows a stale RSC.
- `{ expire: 0 }` = immediate expiration (correct for admin writes). Never use 1-arg
  `revalidateTag(tag)` — TypeScript error in Next.js 16 (signature requires 2 args).
- **DO NOT** add `cacheComponents: true` to `next.config.ts` — it enables PPR which
  is incompatible with `React.cache()`, `Date.now()`, and route segment configs.

## ISR — `src/app/(blog)/[slug]/page.tsx`
- `generateStaticParams` + `dynamicParams = true`: all known slugs are prerendered as
  static HTML (`●` SSG) at deploy; new slugs render on-demand (ISR). This works because
  `getPost` is wrapped in `unstable_cache` (tag `posts`), so the underlying `no-store`
  Blob fetch sits behind the data cache and the page output is cacheable. An edit
  (`revalidateTag('posts')` + `revalidatePath('/slug')`) regenerates the static page.
- List pages (home, category, tag) are dynamic because they access `searchParams`.
- `unstable_cache` still provides cross-request caching for list data even though
  detail pages are dynamic.

## Data layer reference — `src/lib/`

| File | Key exports | Notes |
|---|---|---|
| `blob.ts` | `blobUrl`, `readJson`, `readText`, `writeJson`, `writeText`, `uploadFile`, `deleteByUrl`, `deleteByPathname`, `listBlobs` | All Blob I/O. Never call `list()` to find a URL — use `blobUrl()` |
| `posts.ts` | `getIndex`, `getPublicPosts`, `getPost`, `savePost`, `deletePost`, `getCategories`, `getTags` | `getPublicPosts` = `unstable_cache`; `getPost` = `React.cache()`. `savePost` snapshots the about-to-be-overwritten version via `revisions.ts` (time machine) |
| `revisions.ts` | `getRevisions`, `pushRevision`, `renameRevisions`, `deleteRevisions` | Last 3 overwritten versions per post at `revisions/{slug}.json` (newest first). Drives the editor "time machine". Moved on slug change, removed on delete |
| `pages.ts` | `getPageIndex`, `getPublicPages`, `getPage`, `savePage`, `deletePage` | Mirrors posts.ts; `getPublicPages` = `unstable_cache`; `getPage` = `React.cache()` |
| `settings.ts` | `getSettings`, `saveSettings`, `DEFAULT_SETTINGS`, `DEFAULT_THEME`, `themeToCss` | `getSettings` = `unstable_cache`; `themeToCss` converts ThemeSettings → CSS vars string |
| `media.ts` | `getMedia`, `addMedia`, `deleteMedia` | Raster images auto-converted to WebP ≤1600px on upload; SVG/GIF pass through |
| `auth.ts` | `handlers`, `auth`, `signIn`, `signOut`, `isAuthorized`, `getAuthState` | Anyone can sign in; only `AUTHORIZED_EMAIL` is authorized; unauthorized = silently redirected |
| `slugs.ts` | `ensureSlugFree`, `SlugConflictError` | Posts + pages share the same URL namespace; throws `SlugConflictError` (→ 409) on collision |
| `video.ts` | `videoEmbed`, `isVideoUrl` | Recognizes YouTube / Vimeo / TikTok URLs; returns embed URL. Videos stored as plain URLs in Markdown |
| `paginate.ts` | `paginate`, `parsePage` | Pure helper; `parsePage` converts `searchParams.page` → number |
| `i18n.ts` | `t(lang)`, `formatDate` | Thin loader over `src/locales/`; `formatDate` uses Intl per-lang (vi custom) |
| `utils.ts` | `slugify`, `deriveExcerpt`, `clampExcerpt`, `isPublicallyVisible`, `formatBytes`, `formatDateVi`, `formatDateTimeShort`, `formatTime` | `isPublicallyVisible` = `status === 'published'` AND date is past |
| `api.ts` | `ok`, `fail`, `logRequest`, `logError`, `requireOwner` | Shared API helpers. Every route must call `requireOwner()` first |
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

## SEO (toggleable in Admin → Settings → SEO)
- `settings.seo` = `{ autoSchema, sitemap, llms, robots, rss, ogImage, ogFallbackImage }`
  (booleans default true; `ogFallbackImage` '') + `settings.siteUrl` (canonical base;
  '' → `VERCEL_PROJECT_PRODUCTION_URL` → localhost, via `resolveSiteUrl()`). Drives
  `metadataBase` and every absolute URL below.
- `app/robots.ts` → robots.txt (always disallows `/admin` + `/api`; advertises the
  sitemap when robots + sitemap are on).
- `app/sitemap.ts` → sitemap.xml (home + posts + pages + categories + tags).
- `app/llms.txt/route.ts` → /llms.txt, a Markdown content index for AI crawlers
  (llmstxt.org); 404 when off.
- `app/feed.xml/route.ts` → RSS 2.0 (latest 50 posts); 404 when off; auto-discovered
  via root metadata `alternates`.
- `app/og/route.tsx` → dynamic OG image (1200×630, **edge runtime**, Be Vietnam Pro
  TTFs bundled beside it and loaded via `fetch(new URL('./x.ttf', import.meta.url))`).
  Fully query-driven (`title`/`site`/`bg`), no Blob read. `lib/og.ts#ogImageUrl`
  picks `bg` = post featured image → `seo.ogFallbackImage` → none, and is used in
  post/page `generateMetadata` for `og:image`.
- JSON-LD via `components/blog/JsonLd.tsx` (`websiteSchema` on home, `articleSchema`
  on posts), gated by `seo.autoSchema`.
- robots/sitemap are static but tagged `settings`, so toggling a feature + saving
  regenerates them (revalidateTag('settings')).
- **Cache-key versioning**: `getSettings` uses key `site-settings-v3`. Vercel's Data
  Cache persists across deploys, so when the settings SHAPE changes (new field) bump
  this key, else the cached object keeps serving without the new key (e.g. rss 404).

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
- **Autosave**: `PostForm` saves every 60s while `dirty` (chained behind any in-flight
  save so autosave + manual save never race). Also warns on unload with unsaved changes.
- **Time machine**: each overwrite snapshots the prior version (`revisions.ts`, keeps 3).
  Editor action bar → "Cỗ máy thời gian" lists them (`GET /api/posts/[slug]/revisions`);
  "Khôi phục" loads a revision into the editor (slug + date stay current) and marks dirty —
  non-destructive, the current version is snapshotted on the next save. `EditorApi.setMarkdown`
  reloads the TipTap doc.

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
- One divider style site-wide: the global `<hr>` (50% width, left-aligned, faint).
  Never use bespoke `border-t`/`border-b` rules as content dividers, and never ALL-CAPS
  text (no `uppercase`) anywhere in shipped UI.
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
- `unstable_cache` still works (deprecated but not removed); `'use cache'` requires
  `cacheComponents: true` which enables PPR — avoid unless the whole app is PPR-ready.
- `revalidateTag(tag, profile)` requires 2 args. Use `{ expire: 0 }` for immediate
  invalidation or `'max'` for stale-while-revalidate. `revalidateTag('tag')` = TS error.
- `cacheComponents: true` bans `dynamic`, `dynamicParams`, `revalidate` route segment
  configs AND `Date.now()` / `new Date()` in server components without Suspense.
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
