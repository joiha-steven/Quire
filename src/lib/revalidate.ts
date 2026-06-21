// Single source of truth for cache invalidation. Every admin write calls exactly
// ONE function here, so the "what to purge" decision lives in one place and is
// always a SUPERSET of the surfaces a change can appear on — it never under-purges,
// which is what made earlier per-tag bookkeeping go stale ("applies late" bugs).
//
// Why not just `revalidatePath('/', 'layout')` everywhere: that also dumps every
// post DETAIL page, so after any edit the first visitor to each of N posts pays a
// cold render. These helpers refresh every LIST/aggregate surface a post can show
// on, while leaving unrelated post bodies warm.
//
// The ONE accepted staleness: the "related posts" box on OTHER post detail pages.
// Adding/editing post X does not purge post Y's page, so if X newly shares a tag
// with Y, Y's related list won't include X until Y's own ISR window (<=1h) or its
// next save. This is cosmetic, self-heals, and the admin "Clear all cache" button
// (revalidateEverything + warm) is the instant full-sync escape hatch.

import { revalidatePath, revalidateTag } from 'next/cache'
import { getPublicPosts } from '@/lib/posts'
import { getPublicPages } from '@/lib/pages'
import { DB_TAG } from '@/lib/db'

// Invalidate every cache-eligible Supabase read so the NEXT render of any purged
// page reads fresh from Postgres (never a stale Data Cache entry). One coarse tag,
// revalidated on every write — no per-key bookkeeping to drift. Pages still only
// re-render when their PATH is purged below; this just guarantees fresh data then.
function freshenData(): void {
  // Next 16 requires a second arg; 'max' purges the tag across all cache profiles.
  revalidateTag(DB_TAG, 'max')
}

// Every route that lists or aggregates post metadata. A post's
// title/excerpt/date/taxonomy shows on ALL of these, so any post create/edit/
// delete must refresh them. The bracketed dynamic forms (+ 'page') cover every
// slug and every pagination page in one call — no per-value list to drift.
// (/search is force-dynamic, so it is always fresh and needs no purge.)
function revalidatePostLists(): void {
  revalidatePath('/') // home, page 1
  revalidatePath('/page/[n]', 'page') // home pagination
  revalidatePath('/category/[slug]', 'page') // every category, page 1
  revalidatePath('/category/[slug]/page/[n]', 'page') // every category, deep pages
  revalidatePath('/tag/[slug]', 'page') // every tag, page 1
  revalidatePath('/tag/[slug]/page/[n]', 'page') // every tag, deep pages
  revalidatePath('/feed.xml') // RSS (ISR-cached)
  revalidatePath('/sitemap.xml') // sitemap (ISR-cached)
  revalidatePath('/llms.txt') // AI content index (ISR-cached)
}

// A brand-new post: not on its own detail URL yet (renders on first visit), but
// it appears on every list surface immediately.
export function revalidateNewPost(): void {
  freshenData()
  revalidatePostLists()
}

// An edited or deleted post: refresh its own detail page (old + new slug when the
// slug changed) AND every list surface (its metadata lives there too).
export function revalidatePost(slug: string, previousSlug?: string): void {
  freshenData()
  revalidatePath(`/${slug}`)
  if (previousSlug && previousSlug !== slug) revalidatePath(`/${previousSlug}`)
  revalidatePostLists()
}

// Static pages are standalone: a page appears only on its own URL (+ sitemap /
// llms index), never on post lists or taxonomy. Purge just its path(s) and those.
export function revalidatePage(slug: string, previousSlug?: string): void {
  freshenData()
  revalidatePath(`/${slug}`)
  if (previousSlug && previousSlug !== slug) revalidatePath(`/${previousSlug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/llms.txt')
}

// Settings (theme, menu, title, SEO toggles, siteUrl) affect EVERY rendered page,
// so this is the one case that still purges the whole site under the root layout.
export function revalidateEverything(): void {
  freshenData()
  revalidatePath('/', 'layout')
}

// Re-render the home page + the newest detail pages so the cache is primed after a
// purge. Best-effort: a failed warm fetch never throws. `origin` comes from the
// incoming request. Shared by the "Clear all cache" button and settings save.
const WARM_LIMIT = 12 // home + this many of the newest posts/pages
export async function warmCache(origin: string, limit = WARM_LIMIT): Promise<number> {
  const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])
  const slugs = [...posts.map((p) => p.slug), ...pages.map((p) => p.slug)].slice(0, limit)
  const paths = ['/', ...slugs.map((s) => `/${s}`)]
  const warmed = await Promise.allSettled(
    paths.map((p) => fetch(`${origin}${p}`, { cache: 'no-store' })),
  )
  return warmed.filter((r) => r.status === 'fulfilled').length
}
