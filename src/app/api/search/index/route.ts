// GET /api/search/index -> the lean, pre-folded search index (public read).
// Backs the header search overlay: it fetches this once on first open for instant,
// accent-insensitive title/tag filtering, then merges body hits from /api/search.
// Same shape as the /search page's server-built index: { slug, title, date, terms }.

import type { NextRequest } from 'next/server'
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { foldAccents } from '@/lib/utils'
import { ok, fail, logRequest, logError } from '@/lib/api'

// ISR-cached like the other public reads (purged on any post save via revalidate).
export const revalidate = 3600

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    const { features } = await getSettings()
    if (!features.search) {
      logRequest(req, 404, start)
      return fail('Search disabled', 404)
    }
    const posts = await getPublicPosts()
    const docs = posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      terms: foldAccents([p.title, p.tags.join(' '), p.categories.join(' ')].join(' ')),
    }))
    logRequest(req, 200, start)
    return ok(docs)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to build search index', 500)
  }
}
