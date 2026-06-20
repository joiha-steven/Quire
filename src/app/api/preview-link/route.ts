// GET /api/preview-link?slug=... -> { token } for a shareable draft preview URL.
// Owner only. The client builds `${origin}/preview/${slug}?key=${token}`.
import type { NextRequest } from 'next/server'
import { previewToken } from '@/lib/preview'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const slug = new URL(req.url).searchParams.get('slug')
    if (!slug) {
      logRequest(req, 400, start)
      return fail('Missing slug', 400)
    }
    logRequest(req, 200, start)
    return ok({ token: previewToken(slug) })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to build preview link', 500)
  }
}
