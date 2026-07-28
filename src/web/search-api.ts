// GET /api/search?q= — full-text search over title and body.
//
// Backs the search overlay, which needs results without a page load. The `/search` page
// renders the same results server-side, so a reader with no JavaScript loses the overlay
// and keeps the search.
//
// Metadata only, never bodies: the result list renders three fields and sending the rest
// would make a public endpoint an efficient way to dump the whole blog.

import type { Context } from 'hono'
import { searchPosts } from '@/content/posts'
import { getSettings } from '@/content/settings'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { fail, json } from '@/web/api'

/** Generous per-IP cap. A public full-text endpoint should not be a free database-load lever. */
const PER_MINUTE = 60

export async function handleSearch(c: Context): Promise<Response> {
  if (rateLimited(`search:${clientIp(c.req.raw)}`, PER_MINUTE)) {
    return fail(c, 'Too many requests', 429)
  }
  // The same gate the `/search` page honours. Off means off everywhere, not just in the UI.
  const { features } = await getSettings()
  if (!features.search) return fail(c, 'Search disabled', 404)

  const posts = await searchPosts(c.req.query('q') ?? '')
  return json(posts.map((p) => ({ slug: p.slug, title: p.title, date: p.date })))
}
