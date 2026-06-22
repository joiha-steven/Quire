// POST /api/backup/restore  { fileId }  -> restore a snapshot (owner only).
// DESTRUCTIVE: replaces every text table + re-uploads every blob. A pre-restore
// safety snapshot is taken automatically (see lib/backup.ts).

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { restoreBackup } from '@/lib/backup'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { fileId?: unknown }
    const fileId = typeof body.fileId === 'string' ? body.fileId : ''
    if (!fileId) {
      logRequest(req, 400, start)
      return fail('Missing fileId', 400)
    }
    await restoreBackup(fileId)
    after(() => logActivity('backup.restore', fileId))
    logRequest(req, 200, start)
    return ok({ restored: fileId })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail((error as Error).message || 'Restore failed', 500)
  }
}
