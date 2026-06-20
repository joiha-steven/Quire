// POST /api/cache/clear -> purge the whole public cache, then warm it (owner only).
// Public pages are ISR-cached (revalidate); this forces an immediate refresh of
// everything and re-renders the key pages so the next visitor gets a warm cache.

import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getPublicPosts } from '@/lib/posts'
import { getPublicPages } from '@/lib/pages'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Warming fetches several pages; give it room.
export const maxDuration = 60

const WARM_LIMIT = 12 // home + this many of the newest posts/pages

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }

    // 1) Purge everything under the root layout (every public route).
    revalidatePath('/', 'layout')

    // 2) Warm: re-render the home page + the newest detail pages so the cache is
    //    primed. Best-effort — a failed warm fetch never fails the request.
    const origin = new URL(req.url).origin
    const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])
    const slugs = [...posts.map((p) => p.slug), ...pages.map((p) => p.slug)].slice(0, WARM_LIMIT)
    const paths = ['/', ...slugs.map((s) => `/${s}`)]
    const warmed = await Promise.allSettled(
      paths.map((p) => fetch(`${origin}${p}`, { cache: 'no-store' })),
    )
    const ok_count = warmed.filter((r) => r.status === 'fulfilled').length

    logRequest(req, 200, start)
    return ok({ purged: true, warmed: ok_count })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to clear cache', 500)
  }
}
