# CHANGELOG

## 2026-06-20
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
