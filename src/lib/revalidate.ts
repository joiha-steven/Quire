// Single source of truth for cache invalidation. Every admin write calls ONE
// function here, always a SUPERSET of the affected surfaces (never under-purges).
// Not `revalidatePath('/', 'layout')` everywhere because that dumps every post
// DETAIL page too (cold render for the next visitor of each); these refresh only
// LIST/aggregate surfaces, leaving unrelated bodies warm.
//
// ONE accepted staleness: the "related posts" box on OTHER posts. Editing X
// doesn't purge Y, so Y's related list updates only on Y's ISR window (<=1h) /
// next save. Cosmetic, self-heals; "Clear all cache" is the full-sync escape hatch.

import { revalidatePath, revalidateTag } from 'next/cache'
import { getPublicPosts } from '@/lib/posts'
import { getPublicPages } from '@/lib/pages'
import { DB_TAG } from '@/lib/db'

// Invalidate every cache-eligible Supabase read so the next render of a purged
// page reads fresh from Postgres. One coarse tag; pages still re-render only when
// their PATH is purged below.
function freshenData(): void {
  // Next 16 requires a second arg; 'max' purges across all cache profiles.
  revalidateTag(DB_TAG, 'max')
}

// Every route that lists/aggregates post metadata. Bracketed dynamic forms (+
// 'page') cover all slugs + pagination in one call. (/search is force-dynamic.)
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

// New post: not on its own URL yet (renders on first visit); refresh the lists.
export function revalidateNewPost(): void {
  freshenData()
  revalidatePostLists()
}

// Edited/deleted post: refresh its own page (old + new slug) AND every list surface.
export function revalidatePost(slug: string, previousSlug?: string): void {
  freshenData()
  revalidatePath(`/${slug}`)
  if (previousSlug && previousSlug !== slug) revalidatePath(`/${previousSlug}`)
  revalidatePostLists()
}

// Pages are standalone: only their own URL + sitemap/llms, never post lists/taxonomy.
export function revalidatePage(slug: string, previousSlug?: string): void {
  freshenData()
  revalidatePath(`/${slug}`)
  if (previousSlug && previousSlug !== slug) revalidatePath(`/${previousSlug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/llms.txt')
}

// Settings affect EVERY page → purge the whole site under the root layout.
export function revalidateEverything(): void {
  freshenData()
  revalidatePath('/', 'layout')
}

// Prime the cache after a purge (home + newest pages). Best-effort, never throws.
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
