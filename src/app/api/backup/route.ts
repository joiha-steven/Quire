// GET    /api/backup  -> backup status + snapshot list (owner only)
// POST   /api/backup  -> run a full snapshot now (owner only)
// DELETE /api/backup?id=<fileId>  -> delete one snapshot from Drive (owner only)

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { runBackup, listBackups, deleteBackup } from '@/lib/backup'
import { getBackupState, toStatus } from '@/lib/backup-state'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// A full snapshot streams every blob through the function — give it headroom.
export const maxDuration = 300
// Owner-only live data: the snapshot list must reflect Drive immediately.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const status = toStatus(await getBackupState())
    const snapshots = await listBackups()
    logRequest(req, 200, start)
    return ok({ status, snapshots })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read backups', 500)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const result = await runBackup()
    after(() => logActivity('backup.run', result.name))
    logRequest(req, 200, start)
    return ok(result)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail((error as Error).message || 'Backup failed', 500)
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      logRequest(req, 400, start)
      return fail('Missing id', 400)
    }
    await deleteBackup(id)
    after(() => logActivity('backup.delete', id))
    logRequest(req, 200, start)
    return ok({ deleted: id })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete snapshot', 500)
  }
}
