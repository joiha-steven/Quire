// PUT /api/settings -> update site settings (owner only).
// Public reads happen server-side via lib/settings, so no public GET is needed.

import type { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { SiteSettings } from '@/types'
import { saveSettings } from '@/lib/settings'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function PUT(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json()) as Partial<SiteSettings>
    const next = await saveSettings(body)
    revalidateTag('settings', { expire: 0 })
    revalidatePath('/', 'layout')
    logRequest(req, 200, start)
    return ok(next)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to save settings', 500)
  }
}
