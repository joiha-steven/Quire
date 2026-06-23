// POST /api/files/attach -> server-mediated attachment upload for the LOCAL storage
// driver (owner only). Multipart form: one or more "file" parts. The browser sends
// the bytes here (no client-direct-to-store path off Vercel); the route writes them
// via the storage facade and inserts the rows (addFilesBatch) — the server-side twin
// of /api/files/register. Any content type, like the catch-all attachment library.
import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { addFilesBatch } from '@/lib/files'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const maxDuration = 60

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const form = await req.formData()
    const files = form.getAll('file').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      logRequest(req, 400, start)
      return fail('No files provided', 400)
    }
    const inputs: { filename: string; body: ArrayBuffer; contentType: string }[] = []
    for (const f of files) {
      inputs.push({ filename: f.name, body: await f.arrayBuffer(), contentType: f.type || 'application/octet-stream' })
    }
    const uploaded = await addFilesBatch(inputs)
    after(() => logActivity('file.add', `${uploaded.length} file(s)`))
    logRequest(req, 201, start)
    return ok(uploaded, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to upload files', 500)
  }
}
