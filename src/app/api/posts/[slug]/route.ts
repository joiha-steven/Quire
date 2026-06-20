// GET    /api/posts/[slug]  -> full post (public read)
// PUT    /api/posts/[slug]  -> overwrite post (owner only)
// DELETE /api/posts/[slug]  -> delete post (owner only)

import type { NextRequest } from 'next/server'
import type { PostWithContent } from '@/types'
import { getPost, savePost, deletePost } from '@/lib/posts'
import { finalizeContentMedia } from '@/lib/media'
import { revalidatePost } from '@/lib/revalidate'
import { SlugConflictError } from '@/lib/slugs'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Saving may generate deferred AVIF/WebP variants for newly-kept images.
export const maxDuration = 60

export async function GET(req: NextRequest, ctx: RouteContext<'/api/posts/[slug]'>): Promise<Response> {
  const start = Date.now()
  try {
    // Owner only: returns any post incl. drafts. Public detail page reads server-side.
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { slug } = await ctx.params
    const post = await getPost(slug)
    if (!post) {
      logRequest(req, 404, start)
      return fail('Post not found', 404)
    }
    logRequest(req, 200, start)
    return ok(post)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read post', 500)
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/posts/[slug]'>): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { slug } = await ctx.params
    const body = (await req.json()) as Partial<PostWithContent>
    const meta = await savePost(body, slug)
    await finalizeContentMedia(body.content ?? '', body.featuredImage ?? undefined)
    // Refresh this post's page (old + new slug) and every list/taxonomy surface.
    revalidatePost(meta.slug, slug)
    logRequest(req, 200, start)
    return ok(meta)
  } catch (error) {
    if (error instanceof SlugConflictError) {
      logRequest(req, 409, start)
      return fail('slug_taken', 409)
    }
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to update post', 500)
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/posts/[slug]'>): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { slug } = await ctx.params
    await deletePost(slug)
    revalidatePost(slug) // drop its now-404 page + refresh every list surface
    logRequest(req, 200, start)
    return ok({ slug })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete post', 500)
  }
}
