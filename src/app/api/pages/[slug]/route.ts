// GET    /api/pages/[slug]  -> full page (owner only)
// PUT    /api/pages/[slug]  -> overwrite page (owner only)
// DELETE /api/pages/[slug]  -> delete page (owner only)

import type { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PageWithContent } from '@/types'
import { getPage, savePage, deletePage } from '@/lib/pages'
import { SlugConflictError } from '@/lib/slugs'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

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
    revalidateTag('pages', { expire: 0 })
    revalidatePath(`/${meta.slug}`)
    if (slug !== meta.slug) revalidatePath(`/${slug}`)
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
    revalidateTag('pages', { expire: 0 })
    revalidatePath(`/${slug}`)
    logRequest(req, 200, start)
    return ok({ slug })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete page', 500)
  }
}
