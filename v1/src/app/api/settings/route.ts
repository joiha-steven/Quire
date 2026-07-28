// PUT /api/settings -> update site settings (owner only).
// Public reads happen server-side via lib/settings, so no public GET is needed.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SiteSettings } from '@/types'
import { saveSettings } from '@/lib/settings'
import { revalidateEverything, warmCache } from '@/lib/revalidate'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Settings save purges the whole site then warms it (fetches several pages).
export const maxDuration = 60

export async function PUT(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json()) as Partial<SiteSettings>
    const next = await saveSettings(body)
    // Theme/menu/title/SEO live site-wide, so purge everything then re-warm the
    // key pages so the change is visible without a cold first hit.
    revalidateEverything()
    await warmCache()
    after(() => logActivity('settings.save'))
    logRequest(req, 200, start)
    return ok(next)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to save settings', 500)
  }
}
