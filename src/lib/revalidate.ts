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
import { after } from 'next/server'
import { getPublicPosts } from '@/lib/posts'
import { getPublicPages } from '@/lib/pages'
import { purgeCloudflare } from '@/lib/cdn'
import { DB_TAG } from '@/lib/db'

// Invalidate every cache-eligible DB read so the next render of a purged page reads
// fresh from Postgres. One coarse tag; pages still re-render only when their PATH is
// purged below. Every content write goes through here, so this is also where we clear
// a CDN in front (Cloudflare) — it can't see the tag purge, so without this an edit
// would stay stale at the edge until the CDN's own TTL. No-op when unconfigured.
function freshenData(): void {
  // Next 16 requires a second arg; 'max' purges across all cache profiles.
  revalidateTag(DB_TAG, 'max')
  // Best-effort CDN purge, post-response. `after` throws outside a request scope (unit
  // tests call these helpers directly) — ignore that; a real write always has one.
  try {
    after(() => purgeCloudflare())
  } catch {
    /* not in a request scope */
  }
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

// Prime the ORIGIN render cache (ISR) after a purge: re-fetch home + newest pages over
// the LOCAL loopback (127.0.0.1), NOT the public host — a self-request through Cloudflare
// loops and is flaky, and would only warm the origin-region POP anyway. Warming the ISR
// is what helps every reader: their first post-purge cache MISS (at any CF POP) then gets
// a pre-rendered origin response instead of a cold render. Best-effort, never throws.
const WARM_LIMIT = 12 // home + this many of the newest posts/pages
const LOCAL_ORIGIN = `http://127.0.0.1:${process.env.PORT || 3000}`
export async function warmCache(limit = WARM_LIMIT): Promise<number> {
  const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])
  const slugs = [...posts.map((p) => p.slug), ...pages.map((p) => p.slug)].slice(0, limit)
  const paths = ['/', ...slugs.map((s) => `/${s}`)]
  const warmed = await Promise.allSettled(
    paths.map((p) => fetch(`${LOCAL_ORIGIN}${p}`, { cache: 'no-store' })),
  )
  return warmed.filter((r) => r.status === 'fulfilled').length
}

// Full purge + warm, in the ONLY order that re-primes correctly: purge the origin ISR
// AND the whole Cloudflare zone FIRST (awaited), THEN warm the origin ISR (warming before
// the purge just re-caches stale bytes the purge then wipes). Used by "Clear all cache"
// and the deploy flush. NOTE: this warms the ORIGIN render cache, not Cloudflare's edge —
// CF cache is per-datacentre and can't be pre-filled for a distant reader's POP from here;
// enable CF Tiered Cache so a POP miss pulls from a warm tier, not the far origin.
export async function purgeAndWarm(limit = WARM_LIMIT): Promise<number> {
  revalidateTag(DB_TAG, 'max')
  revalidatePath('/', 'layout')
  await purgeCloudflare()
  return warmCache(limit)
}
