// POST /api/cache/clear -> purge every data-cache tag + the whole route tree
// (owner only). Manual "see my changes now" escape hatch from the admin header.

import type { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

const TAGS = ['posts', 'pages', 'media', 'settings'] as const

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    for (const tag of TAGS) revalidateTag(tag, { expire: 0 })
    revalidatePath('/', 'layout')
    logRequest(req, 200, start)
    return ok({ cleared: true })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to clear cache', 500)
  }
}
