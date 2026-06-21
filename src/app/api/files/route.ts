// GET /api/files -> the file-library manifest (owner only).
// Uploads go straight from the browser to Blob (see /api/files/blob-token +
// /api/files/register) so they bypass the serverless 4.5MB request-body limit.

import type { NextRequest } from 'next/server'
import { getFiles } from '@/lib/files'
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
