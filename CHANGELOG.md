# CHANGELOG

## 2026-06-21
- perf(region): `vercel.json` pins functions to `sin1` (Singapore) — was running in `iad1` (US-East), ~200ms from Vietnam; Singapore is ~40ms. Blob store still in `iad1` (cross-region only on cache miss)

- feat(i18n): 4 new UI languages — German, Japanese, Simplified Chinese, Korean (now en/vi/de/ja/zh/ko); **English is the default**
- refactor(i18n): strings moved to `src/locales/{<code>,admin/<code>}.ts`; `langs.ts` is the single source of truth (`SITE_LANGS` + `isSiteLang`); `satisfies` enforces every key in every language; `formatDate` is now Intl-per-locale (vi keeps custom form); language picker wraps
- fix(admin): language switch is now instant (optimistic `I18nProvider` state), no longer waits for the save round-trip
- fix(i18n): localize ~32 strings that were hardcoded Vietnamese (settings cards, reader-feature toggles, SEO fields, time machine, editor toasts) — they now translate in all 6 languages
- feat(admin): "Clear cache" button in the header (purges every data-cache tag + reloads) for an immediate "see my changes now" escape hatch

## 2026-06-20
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
