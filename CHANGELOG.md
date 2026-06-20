# CHANGELOG

## 2026-06-24
- **feat(admin): manage categories & tags (new Phân loại tab).** A third tab on the content
  dashboard lists every category and tag with its usage count and lets you **rename** (merges
  into an existing term) or **remove** it across ALL posts in one action (`updateTerm` →
  `POST /api/taxonomy`, owner-only; rewrites each affected `.md` + the index, then full purge)
- **feat(admin): open-in-new-tab row action.** Each published post/page row gets an
  open-in-new-tab icon (left of edit) → its public URL; drafts omit it (would 404)
- **fix(admin): mobile-friendly content tables.** Secondary columns now hide on small screens
  (posts: date `sm`, categories `md`; pages: slug `sm`) so Title + Status + actions always fit
  and the status pill never wraps awkwardly. The tab + new-post row wraps on mobile too
- **fix(admin): header alignment + bigger logo.** The `vibeblog` wordmark, its `v0.x.y` badge
  and the menu now share one vertically-centred line (was baseline-misaligned)
- **fix(admin): header polish.** Wordmark enlarged to logo size (`text-xl`); the version
  (`v0.7.5`) sits next to it and links to GitHub releases (replaces the removed footer link).
  Every header item now shares a fixed-height (`h-9`) `ADMIN_NAV` box so the row stays
  perfectly aligned on one line (fixes the recurring "menu not lined up" drift)
- **feat(admin): cleaner, responsive header + no footer.** The admin top bar is now one
  uniform row of text links: a `vibeblog` wordmark (bold `blog`) replaces the old bold
  "Quản trị" brand; the first nav link is now **Trang chủ** (was "Quản trị"). The three
  right-side controls (theme, clear-cache, sign-out) are styled as the SAME text links as the
  menu — no longer button-shaped — and the theme control shows the applied theme as a **word**
  instead of a sun/moon icon. On mobile the whole menu collapses behind a **hamburger** toggle
  instead of spilling inline. Removed the `vibeblog vX · changelog` admin footer. New
  `AdminHeader` client component; `ADMIN_NAV` shared style; `ThemeToggle` gains `variant='text'`;
  `CacheButton` gains a `className`. Locale key `navAdmin` → `navHome` (all 6 languages)
- **feat(seo): richer robots.txt policy.** Replaces the bare allow-all with three groups:
  major search engines + reputable AI assistants (Googlebot/Bingbot…, GPTBot/ClaudeBot/
  PerplexityBot/Google-Extended…, paired with `/llms.txt`) are explicitly allowed; aggressive
  SEO/data scrapers (`BAD_BOTS`: AhrefsBot, SemrushBot, MJ12bot, DotBot, PetalBot, Bytespider…)
  get `Disallow: /` to save crawl budget/bandwidth; `*` stays welcoming so unknown good bots
  (incl. new AI crawlers) keep working. Bot lists are editable consts atop `app/robots.ts`.
  Still gated by `seo.robots`; `/admin` + `/api` always off-limits
- **docs(claude): document media portability / no vendor lock-in.** New "Portability"
  section in CLAUDE.md: content is stored vendor-host-free (store-relative refs), the vanity
  domain already fronts media, Vercel coupling is isolated to `src/lib/blob.ts`, and a
  step-by-step path to migrate to an S3-compatible store (e.g. Cloudflare R2) without
  rewriting content or breaking public URLs
- chore(release): pre-release audit — `build`, `lint`, `tsc` all clean; verified every
  write/delete API route is owner-gated; removed an unused var in `remap-original-images.mjs`

- **feat(seo): dynamic OG cards for the home, category and tag pages** (same card as
  posts/pages). Home: top line = domain, bottom = site description. Category: top line = the
  name; tag: top line = `#name` (the # marks it as a tag); both bottom = domain. Honors the
  dynamic-OG toggle + fallback image like the rest;
  new `ogCardUrl`/`siteDomain` helpers in `lib/og.ts`. The OG `site` line is now length-capped
- **fix(blog): desktop table-of-contents pinned to the viewport's left edge (50px in).**
  It was absolutely positioned against the centered content column's left edge, so wide /
  full-bleed images broke out into the gutter and overlapped it. Now `fixed` to the viewport,
  vertically centred (clears header/footer), with a max-height scroll for long lists
- **fix(admin): even header action cluster.** The "Clear cache" button was missing `text-sm`
  (oversized text) and changed width while busy (the `…` suffix), making it look lopsided next
  to the nav. Clear-cache + sign-out now share one `HEADER_ACTION` class constant
  (`components/admin/headerActions.ts`) so they can't drift again; busy state is shown by
  dimming, not a width-changing label. Convention added to CLAUDE.md
- **refactor(cache): all invalidation centralized in `src/lib/revalidate.ts` + scoped purges.**
  Edits now apply reliably and without dumping the whole site each time: a new post refreshes
  only the list/taxonomy surfaces (home, pagination, every category/tag page, feed/sitemap/llms)
  and leaves other post bodies warm; editing/deleting a post also refreshes its own page;
  editing a static page touches just its URL + sitemap; settings still purge the whole site and
  now re-warm it. Each helper is a deliberate SUPERSET of affected surfaces, so a change is
  never under-purged (the old "applies late" bug). One accepted minor staleness: the related-
  posts box on other posts (self-heals ≤1h, or use "Clear all cache")
- **fix(admin): editor save now calls `router.refresh()`** (PostForm + PageForm, matching
  SettingsView) so the client Router Cache is dropped — saves show on the next navigation
  instead of lagging behind a stale RSC. Pairs with the `staleTimes` config fix below
- **feat(security): baseline security response headers on every route** (`next.config.ts`
  `headers()`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/topics off). HSTS is
  already added by Vercel. CSP deliberately deferred (needs nonces + Report-Only rollout for
  the inline theme script + Analytics + OG + Blob images)
- fix(config): `experimental.staleTimes.static` was set to `0`, which Next 16 rejects (min 30)
  and silently ignored — leaving static routes on the ~5min client-cache default. Set to `30`
  (lowest accepted), so soft-nav freshness now matches the documented intent
- **refactor(cache): ISR pages + full purge on save (replaces yesterday's force-dynamic).**
  Public pages are ISR-cached again for speed (`revalidate = 3600`; `/[slug]` prerendered via
  `generateStaticParams`), but every admin write now calls a single `revalidatePath('/',
  'layout')` that purges the WHOLE site — so an edit (content, theme/background, anything) is
  live on the next request. Reliable this time because it's ONE cache layer (no
  `unstable_cache`), the Full Route Cache is per-deployment (no cross-deploy stale), and Blob
  reads are `?ts`-busted (fresh on every regeneration). `blob.ts` reads switched from
  `cache: 'no-store'` to `{ next: { revalidate } }` so pages can be ISR-cached
- fix(settings): changing site settings (e.g. background color) now applies immediately —
  the save purges the cached layout/theme site-wide
- feat(admin): "Clear all cache" button is back and actually works — purges everything
  (`revalidatePath('/', 'layout')`) then warms the home + newest detail pages (`/api/cache/clear`)
- admin is fully `force-dynamic` (uncached) so the editor/media/settings always reflect the
  current Blob state; client Router Cache fully off (`staleTimes { dynamic: 0, static: 0 }`)

## 2026-06-23
- **refactor(cache): removed the data cache entirely — content is now always fresh.**
  `unstable_cache` + tag revalidation kept fighting Blob's read-after-write and serving
  stale content (new posts missing, **deleted media reappearing**, settings not applying,
  cross-deploy Data Cache persistence). Replaced with: reads use `React.cache()` only
  (request-scoped dedup), and every public page + SEO route is `force-dynamic`. An edit
  now shows on the next plain reload — no rebuild, no "Clear cache" step
- removed the admin "Clear cache" button and `/api/cache/clear` (no cache to clear); the
  `/[slug]` page is no longer SSG (`generateStaticParams` dropped) — it renders fresh;
  dropped all cache-key versioning. Blob store confirmed in Singapore beside the functions
- fix(media): deleting an image in the library now sticks (it was the data cache re-serving
  the old manifest after the delete) — addressed by the always-fresh reads above

## 2026-06-22
- fix(media): inserted images that didn't show. A `<picture>` gives NO fallback when a
  chosen `<source>` 404s, but `PostContent` emitted AVIF/WebP sources for every jpg/png
  *by convention* — so any image whose deferred variants weren't generated rendered blank.
  Now `<picture>` is emitted ONLY for originals whose variants are confirmed (media index
  `variants:true`, passed to `PostContent`); everything else is a plain `<img>` of the
  original, which always loads. Save routes also `revalidateTag('media')` so the
  optimized `<picture>` appears once variants exist. Existing broken posts self-heal
- fix(type): body text now renders at full weight — removed `-webkit-font-smoothing:
  antialiased` (body + the `<html>` `antialiased` class) which thinned glyphs and made
  reading look lighter than the old blog; dropped the negative body `letter-spacing`
  (-0.011em) that cramped accented Vietnamese. Font stays Inter; heading tracking kept
- fix(media): uploads were intermittently failing ("lúc ăn lúc không"). Root causes
  fixed: (1) the whole multi-file upload now does ONE read-modify-write of the manifest
  (`addMediaBatch`) instead of one per file, removing the lost-update race that dropped
  entries; (2) collision naming (`logo` → `logo-2`) now checks the ACTUAL store
  (`listBlobs`) ∪ manifest, so a stale manifest read can't pick a name that already
  exists; (3) `uploadFile` sets `allowOverwrite` as a final safety net so a re-upload
  never hard-throws "blob already exists"
- fix(editor): dragging an image into the editor now inserts reliably — the drop handler
  read a stale (null) editor from its capture closure; it now uses a live `editorRef`.
  Multiple dropped images upload sequentially and insert in order
- feat(seo): pagination is now path-based — `/page/2`, `/category/x/page/2`,
  `/tag/x/page/2` (was `?page=2`). Page 1 stays at the bare path; out-of-range or `/page/1`
  → 404 (no duplicate-content URLs). New `parsePathPage`; shared `BlogListing` component
- feat(read): blog list now shows reading time per post (gated by the readingTime
  feature). `readingMinutes` is computed from the body at save and stored in the index;
  `backfill-reading-time.mjs` filled it for existing posts. Index cache key → `v3`
- fix(ui): single post/page title now uses the same type scale as the blog-list title
  (one title format)

## 2026-06-21
- feat(media): defer heavy variant encoding to save-time — drop/upload stores only the original + thumbnail (`variants:false`); the AVIF/WebP @1024/1600 set is generated by `finalizeContentMedia` on post/page save, only for images kept in the content (an image dropped then discarded never pays the AVIF encode). Save routes get `maxDuration=60`
- feat(media): "Clean unused" library button (`POST /api/media/sweep`, `lib/sweep.ts`) deletes media referenced by no post/page/settings — clears orphans
- feat(media): responsive image pipeline — jpg/png keep the **untouched original** + auto-generate `-1024`/`-1600` in **AVIF + WebP** + a `-thumb.webp`; `PostContent` renders `<picture>` so the browser auto-picks the lightest format/size. Library shows resolution + "download original"; delete removes all variants. svg/gif/webp stored as-is. HEIC dropped. Upload route `maxDuration=60`
- migration(blob): moved store to Singapore (`sin1`) — copied all blobs, collapsed stored URLs to pathnames, swapped `BLOB_READ_WRITE_TOKEN` (all envs), bumped cache keys for a clean cutover; media refs now store-relative end to end
- refactor(blob): store image refs **store-relative** (pathnames, not absolute URLs). `collapseBlob` on write / `expandBlob` on read in the data layer (posts/pages/settings); UI unchanged. Removes storeId lock-in — switching Blob store/region/provider needs no content rewrite. Idempotent, backward-compatible (old absolute URLs self-heal on next save)
- perf(region): `vercel.json` pins functions to `sin1` (Singapore) — was running in `iad1` (US-East), ~200ms from Vietnam; Singapore is ~40ms (Blob store also moved to Singapore, see above)

- feat(i18n): 4 new UI languages — German, Japanese, Simplified Chinese, Korean (now en/vi/de/ja/zh/ko); **English is the default**
- refactor(i18n): strings moved to `src/locales/{<code>,admin/<code>}.ts`; `langs.ts` is the single source of truth (`SITE_LANGS` + `isSiteLang`); `satisfies` enforces every key in every language; `formatDate` is now Intl-per-locale (vi keeps custom form); language picker wraps
- fix(admin): language switch is now instant (optimistic `I18nProvider` state), no longer waits for the save round-trip
- fix(i18n): localize ~32 strings that were hardcoded Vietnamese (settings cards, reader-feature toggles, SEO fields, time machine, editor toasts) — they now translate in all 6 languages
- feat(admin): "Clear cache" button in the header (purges every data-cache tag + reloads) for an immediate "see my changes now" escape hatch

- feat(admin): clearer theme colour picker. The native `<input type="color">` swatch was tiny
  with default chrome, so it didn't read as clickable — enlarged it and stripped the inner
  padding/border so it's one clean colour chip. Clicking it opens the browser's full picker
  (2D area + hue + HEX); the hex field is now monospace/uppercase alongside.
- refactor(theme): every public-UI colour now comes from the theme tokens — no hardcoded
  `neutral-*`/`white`/`black`. Exposed `--c-*` as Tailwind utilities (`bg-bg`, `text-text`,
  `text-heading`, `text-meta`, `text-link`, `border-rule`) via `@theme inline`. **All lines +
  faint surfaces (TOC border, dropdowns, header/footer, code blocks, hovers, preview banner) use
  `--c-rule`**, so one colour in Admin → Giao diện drives them. Also fixes a dark-mode bug where
  code blocks stayed light (hardcoded `#f4f4f2` had no dark override).
- fix(editor): over-spaced bullet/numbered list items. TipTap wraps each item's content in a
  `<p>`, which inherited the 1.4em paragraph margin — items now sit tight + even (only genuine
  multi-paragraph items keep spacing). Shared `.prose` rule, so the editor matches the render.
- feat(editor): rounded out the toolbar to match standard markdown editors — **numbered list**,
  **task list** (GFM `- [ ]`, renders as checkboxes), **inline code**, **horizontal rule**, and
  **insert table** (the Table extension had no way to create one from the UI). Added the TipTap
  **Placeholder** extension so the empty-state hint actually shows (the old root `data-placeholder`
  rendered nothing). New deps: `@tiptap/extension-task-list`, `-task-item`, `-placeholder`.

## 2026-06-20
- feat(admin): **Media domain (CDN)** field in Settings → SEO (`mediaBaseUrl`) — set a vanity
  host for public media URLs from the UI instead of an env var. Owner setting wins, falls back
  to `BLOB_PUBLIC_BASE`; pushed into the Blob layer via `setMediaBase()` on each settings read.
  New admin i18n keys `mediaDomain`/`mediaDomainHint` (all 6 locales). Data-layer reads
  (`posts`/`pages`/`media`) now prime `getSettings()` before `expandBlob`, so the field alone
  drives media URLs reliably (no cold-start ordering race) — the env var is no longer required
- fix(header): render the logo with a plain `<img>` instead of `next/image`. The optimizer
  only allows hosts whitelisted in `next.config` at build time, so a runtime-configurable media
  domain (Settings → Media domain / a Cloudflare Worker) made the optimized logo 404. A plain
  tag loads from whatever host the setting yields — no build coupling, no env, never breaks on a
  domain change. Logos are small + CDN-cached, so the lost optimization is negligible
- feat(seo): `/sitemaps.xml` 308-redirects to `/sitemap.xml` (alias for the plural form / old
  search-console submissions; no second sitemap to keep in sync)
- feat(media): optional vanity domain for public media URLs via `BLOB_PUBLIC_BASE` (e.g. a
  Cloudflare Worker on `files.<domain>` proxying the Blob store). `publicBase()` rewrites only
  rendered media URLs (`expandBlob` + `blobOrigin` preconnect); internal data reads stay on the
  store host (no proxy hop, `?ts` cache-bust intact). `collapseBlob` also strips the vanity host
- fix(content): restored 41 broken post images across 19 imported posts. A prior media wipe
  (removed small/resized versions) left these `media/...` refs 404ing. Re-fetched the ORIGINAL
  full-size files from the source WordPress site via the Rocket.net file API (the public domain
  is behind a Cloudflare challenge that blocks direct fetch), stripping WP `-WxH` resize
  suffixes; uploaded to Blob, rewrote the markdown, rebuilt `media/_index.json`. New scripts:
  `check-image-links.mjs` (audit), `remap-original-images.mjs` (recover + remap)
- feat(seo): SEO tab — JSON-LD schema, `sitemap.xml`, `robots.txt`, `llms.txt`, RSS `feed.xml`, dynamic OG image (`/og`, edge runtime), canonical `siteUrl`; all toggleable
- feat(read): client-side `/search` (lean pre-folded index), table of contents (desktop, sticky), reading-progress bar, related posts, reading time
- feat(admin): `Tính năng` tab — toggle reader features (search/toc/related/readingTime/progressBar); `Link nháp` HMAC draft-preview links (`/preview/[slug]`)
- feat: `@vercel/analytics`; themed `(blog)/not-found.tsx`
- perf: every Blob read wrapped in `unstable_cache` (tags posts/pages/media/settings) → `/[slug]` is now real SSG; `staleTimes { dynamic: 0, static: 180 }`; logo via `next/image`; modern `browserslist` drops legacy-JS polyfills; editor serialization debounced
- fix: public reads degrade to fallback instead of 500; bump `getSettings` cache key (Data Cache persists across deploys)
- refactor(dry): consolidate 3 toggle components into `ui/Switch.tsx`; one `<hr>` divider standard (50% left); no all-caps; drop dead classes
- docs: add `ARCHITECTURE.md`; refresh README caching/usage
- perf: replace `resolveUrl` (`list()` API call) with direct `blobUrl()` — halves Blob read latency
- perf: `getPublicPosts`, `getSettings`, `getPublicPages` cached via `unstable_cache` — cross-request cache with tag-based invalidation
- perf: `getPost` / `getPage` wrapped with `React.cache()` — deduplicates generateMetadata + page render calls
- perf: `[slug]/page.tsx` — `generateStaticParams` + `dynamicParams = true` for ISR (falls back to dynamic due to `revalidate: 0` Blob fetches, but structure is correct)
- perf: all admin write routes call `revalidateTag` / `revalidatePath` after save/delete
- fix: `BLOB_READ_WRITE_TOKEN` regex corrected to `vercel_blob_rw_` (was `vercelblob_rw_`)
- feat: `next.config.ts` — added Vercel Blob image remote patterns
- docs: CLAUDE.md expanded with Blob access, caching model, ISR, data layer reference, scripts

## 2026-06-19
- init: project bootstrapped by Claude Code
- feat: env-driven OAuth providers (Google and/or GitHub)
- feat: Blob-backed posts + media data layer (no database)
- feat: NextAuth v5 GitHub auth with single-owner authorization
- feat: admin dashboard, TipTap markdown editor, media library
- feat: public blog (home, post detail, category, tag) in Vietnamese UI
