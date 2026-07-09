// GET /api/search?q=  -> full-text search over title + body (public read).
// Backs the public search page: the client filters its lean title/tag index
// instantly, then merges these server results so matches inside the article body
// are also found. Returns published + visible posts only (metadata, no body).

import type { NextRequest } from 'next/server'
import { searchPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { ok, fail, logRequest, logError } from '@/lib/api'
import { rateLimited, clientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    // Generous per-IP cap: a public FTS endpoint shouldn't be a free DB-load lever.
    if (rateLimited(`search:${clientIp(req)}`, 60)) {
      logRequest(req, 429, start)
      return fail('Too many requests', 429)
    }
    // Honor the same feature gate as the /search page.
    const { features } = await getSettings()
    if (!features.search) {
      logRequest(req, 404, start)
      return fail('Search disabled', 404)
    }
    const q = new URL(req.url).searchParams.get('q') ?? ''
    const posts = await searchPosts(q)
    // Lean payload: only what the result list renders.
    const results = posts.map((p) => ({ slug: p.slug, title: p.title, date: p.date }))
    logRequest(req, 200, start)
    return ok(results)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Search failed', 500)
  }
}
