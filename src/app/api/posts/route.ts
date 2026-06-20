// GET  /api/posts  -> metadata array (public read)
// POST /api/posts  -> create a post (owner only)

import type { NextRequest } from 'next/server'
import type { PostWithContent } from '@/types'
import { getIndex, savePost } from '@/lib/posts'
import { finalizeContentMedia } from '@/lib/media'
import { revalidateNewPost } from '@/lib/revalidate'
import { SlugConflictError } from '@/lib/slugs'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Saving may generate deferred AVIF/WebP variants for newly-kept images.
export const maxDuration = 60

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    // Owner only: this returns ALL posts incl. drafts. Public pages read server-side.
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const posts = await getIndex()
    logRequest(req, 200, start)
    return ok(posts)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read posts', 500)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json()) as Partial<PostWithContent>
    if (!body.title?.trim() && !body.slug?.trim()) {
      logRequest(req, 400, start)
      return fail('Title or slug is required', 400)
    }
    const meta = await savePost(body)
    await finalizeContentMedia(body.content ?? '', body.featuredImage ?? undefined)
    revalidateNewPost() // refresh every list/taxonomy surface; other posts stay warm
    logRequest(req, 201, start)
    return ok(meta, 201)
  } catch (error) {
    if (error instanceof SlugConflictError) {
      logRequest(req, 409, start)
      return fail('slug_taken', 409)
    }
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to create post', 500)
  }
}
