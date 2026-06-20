// GET  /api/pages  -> metadata array (owner only)
// POST /api/pages  -> create a page (owner only)

import type { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PageWithContent } from '@/types'
import { getPageIndex, savePage } from '@/lib/pages'
import { finalizeContentMedia } from '@/lib/media'
import { SlugConflictError } from '@/lib/slugs'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Saving may generate deferred AVIF/WebP variants for newly-kept images.
export const maxDuration = 60

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    // Owner only: returns ALL pages incl. drafts. Public pages read server-side.
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const pages = await getPageIndex()
    logRequest(req, 200, start)
    return ok(pages)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read pages', 500)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json()) as Partial<PageWithContent>
    if (!body.title?.trim() && !body.slug?.trim()) {
      logRequest(req, 400, start)
      return fail('Title or slug is required', 400)
    }
    const meta = await savePage(body)
    await finalizeContentMedia(body.content ?? '', body.featuredImage ?? undefined)
    revalidateTag('pages', { expire: 0 })
    revalidatePath(`/${meta.slug}`)
    logRequest(req, 201, start)
    return ok(meta, 201)
  } catch (error) {
    if (error instanceof SlugConflictError) {
      logRequest(req, 409, start)
      return fail('slug_taken', 409)
    }
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to create page', 500)
  }
}
