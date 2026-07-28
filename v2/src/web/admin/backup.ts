// The manual archive: everything this install is, in one file.
//
// Quire 2.0 does NOT back up to Google Drive. Continuous replication is litestream's job,
// running beside the process and replicating the SQLite file off the box — parity
// exception 1, which deleted ~730 lines of OAuth, token refresh and Drive folder
// bookkeeping. What that exception promised in exchange is this: an archive the owner can
// download and keep somewhere they control, without a third party in the path.
//
// It is a `tar.gz` of the two databases and the uploads tree. The databases are copied
// through SQLite's own backup API rather than read off disk, because a live database has
// a write-ahead log and copying the file alone can capture a torn state — the one failure
// a backup must not have.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { db, analyticsDb } from '@/store/db'
import { logActivity } from '@/server/activity'
import { fail } from '@/web/api'
import { ownerRouter } from '@/web/guard'

const uploadsDir = (): string => resolve(process.env.STORAGE_LOCAL_DIR || './uploads')

/** `quire-2026-07-28.tar.gz` — sortable, and obvious in a downloads folder a year later. */
function archiveName(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `quire-${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}.tar.gz`
}

export function backupRoutes() {
  const router = ownerRouter()

  router.get('/api/backup/export', async (c) => {
    // A staging directory, so the consistent database copies and the uploads tree can be
    // tarred as one tree with sensible names inside the archive.
    const stage = await mkdtemp(join(tmpdir(), 'quire-export-'))
    try {
      // VACUUM INTO takes a consistent snapshot of a live database, WAL included, and
      // writes a single compact file. This is the reason not to copy quire.db directly.
      db().exec(`vacuum into '${join(stage, 'quire.db').replace(/'/g, "''")}'`)
      analyticsDb().exec(`vacuum into '${join(stage, 'analytics.db').replace(/'/g, "''")}'`)

      const uploads = uploadsDir()
      const args = ['-czf', '-', '-C', stage, 'quire.db', 'analytics.db']
      // The uploads tree is added from its own parent, so it unpacks as `uploads/`
      // regardless of where it lives on this machine.
      if (existsSync(uploads)) args.push('-C', resolve(uploads, '..'), uploads.split(/[\\/]/).pop()!)

      const proc = Bun.spawn(['tar', ...args], { stdout: 'pipe', stderr: 'pipe' })
      // Read fully rather than streaming: the archive has to be complete before the
      // staging directory is removed, and a browser download wants a length anyway.
      const body = await new Response(proc.stdout).arrayBuffer()
      const code = await proc.exited
      if (code !== 0) {
        const why = await new Response(proc.stderr).text()
        console.error(`[ERROR] backup.export: tar exited ${code}: ${why.trim()}`)
        return fail(c, 'Could not build the archive', 500)
      }

      logActivity('backup.export', `${(body.byteLength / 1024 / 1024).toFixed(1)} MB`)
      return new Response(body, {
        headers: {
          'content-type': 'application/gzip',
          'content-disposition': `attachment; filename="${archiveName()}"`,
          'content-length': String(body.byteLength),
        },
      })
    } finally {
      await rm(stage, { recursive: true, force: true })
    }
  })

  return router
}
