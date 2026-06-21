// GET  /api/files -> the file-library manifest (owner only)
// POST /api/files -> upload one or more attachments (owner only)
// Multipart form with one or more "file" fields. Any content type is accepted —
// this is the catch-all store for non-image files (PDF, zip, docx, audio…).

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { getFiles, addFilesBatch } from '@/lib/files'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const items = await getFiles()
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read files', 500)
  }
}

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
      return fail('No file provided', 400)
    }
    const inputs = await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        body: await file.arrayBuffer(),
        contentType: file.type || 'application/octet-stream',
      })),
    )
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
