// POST /api/files/register -> record metadata for attachments the browser already
// uploaded straight to Blob (owner only).
// Body: { items: [{ url, filename, size, contentType }] }. Returns the new list rows.
import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { registerFilesBatch } from '@/lib/files'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

type Item = { url: string; filename: string; size: number; contentType: string }

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { items?: unknown }
    const items = (Array.isArray(body.items) ? body.items : []).filter(
      (i): i is Item =>
        !!i && typeof i.url === 'string' && typeof i.filename === 'string' &&
        typeof i.size === 'number' && typeof i.contentType === 'string',
    )
    if (items.length === 0) {
      logRequest(req, 400, start)
      return fail('No items provided', 400)
    }
    const uploaded = await registerFilesBatch(items)
    after(() => logActivity('file.add', `${uploaded.length} file(s)`))
    logRequest(req, 201, start)
    return ok(uploaded, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to register files', 500)
  }
}
