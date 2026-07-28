// GET    /api/pages/[slug]  -> full page (owner only)
// PUT    /api/pages/[slug]  -> overwrite page (owner only)
// DELETE /api/pages/[slug]  -> delete page (owner only)

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import type { PageWithContent } from '@/types'
import { getPage, savePage, deletePage } from '@/lib/pages'
import { finalizeContentMedia } from '@/lib/media'
import { revalidatePage } from '@/lib/revalidate'
import { SlugConflictError } from '@/lib/slugs'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Display-variant encoding runs AFTER the response via after(); keep headroom.
export const maxDuration = 60

export async function GET(req: NextRequest, ctx: RouteContext<'/api/pages/[slug]'>): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { slug } = await ctx.params
    const page = await getPage(slug)
    if (!page) {
      logRequest(req, 404, start)
      return fail('Page not found', 404)
    }
    logRequest(req, 200, start)
    return ok(page)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read page', 500)
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/pages/[slug]'>): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { slug } = await ctx.params
    const body = (await req.json()) as Partial<PageWithContent>
    const meta = await savePage(body, slug)
    after(async () => {
      try {
        await finalizeContentMedia(body.content ?? '', body.featuredImage ?? undefined)
      } catch (error) {
        logError(req, error)
      }
    })
    revalidatePage(meta.slug, slug) // its page (old + new slug) + sitemap/llms
    after(() => logActivity('page.update', meta.title || meta.slug))
    logRequest(req, 200, start)
    return ok(meta)
  } catch (error) {
    if (error instanceof SlugConflictError) {
      logRequest(req, 409, start)
      return fail('slug_taken', 409)
    }
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to update page', 500)
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/pages/[slug]'>): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { slug } = await ctx.params
    await deletePage(slug)
    revalidatePage(slug) // drop its now-404 page + sitemap/llms
    after(() => logActivity('page.delete', slug))
    logRequest(req, 200, start)
    return ok({ slug })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete page', 500)
  }
}
