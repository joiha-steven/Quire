// POST /api/backup/disconnect -> forget the stored Drive token + folder (owner only).
// Snapshots already on Drive are left untouched; automatic backups stop.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { clearDriveAuth } from '@/lib/backup-state'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    await clearDriveAuth()
    after(() => logActivity('backup.disconnect', 'Google Drive'))
    logRequest(req, 200, start)
    return ok({ disconnected: true })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to disconnect', 500)
  }
}
