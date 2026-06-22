// Full-snapshot backup to Google Drive — SERVER-ONLY. One snapshot = a single
// `.tar.gz` containing `db.json` (every text table) + `blob/<pathname>` (every
// binary) + `manifest.json`. Self-contained: one file restores the whole site.
// Driven by the cron (every `intervalDays`) or the admin "Backup now" button;
// retention keeps the `keep` most recent. Secrets/run-state live in `backup-state`.

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as tar from 'tar'
import { db } from '@/lib/db'
import { blobUrl, listBlobs, uploadFile } from '@/lib/blob'
import { getSettings } from '@/lib/settings'
import { getBackupState, setFolderId, recordRun, type BackupState } from '@/lib/backup-state'
import { accessToken, ensureFolder, listSnapshots, uploadSnapshot, deleteSnapshot, downloadSnapshot, type DriveFile } from '@/lib/gdrive'
import { revalidateEverything } from '@/lib/revalidate'

// Every text table except `backup_state` (it holds the Drive token — never ship the
// secret inside a backup, and restoring it would clobber the live connection).
const TABLES = ['settings', 'posts', 'pages', 'post_revisions', 'media', 'files', 'mcp_tokens', 'activity_log', 'analytics_events', 'analytics_scroll'] as const

const SNAPSHOT_PREFIX = 'vibeblog-'

// Content-type by extension for re-uploading blobs on restore.
const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif',
  gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2',
  ttf: 'font/ttf', otf: 'font/otf', pdf: 'application/pdf',
}
const mimeOf = (p: string): string => MIME[p.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

// Resolve a connected state + a fresh access token, or throw a clear error.
async function connect(): Promise<{ state: BackupState; token: string }> {
  const state = await getBackupState()
  if (!state.refreshToken) throw new Error('Google Drive is not connected')
  return { state, token: await accessToken(state.refreshToken) }
}

// Build the snapshot tarball in a temp dir; returns its path + byte size.
async function buildArchive(): Promise<{ file: string; size: number }> {
  const work = path.join(os.tmpdir(), `vbbackup-${Date.now()}`)
  await fs.mkdir(path.join(work, 'blob'), { recursive: true })

  // 1) Dump every text table.
  const tables: Record<string, unknown[]> = {}
  for (const t of TABLES) {
    const { data, error } = await db().from(t).select('*')
    if (error) throw new Error(`dump ${t}: ${error.message}`)
    tables[t] = data ?? []
  }
  await fs.writeFile(path.join(work, 'db.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables }))

  // 2) Copy every blob binary (immutable; fetched from the public store URL).
  const blobs = await listBlobs()
  for (const b of blobs) {
    const res = await fetch(blobUrl(b.pathname))
    if (!res.ok) throw new Error(`fetch blob ${b.pathname}: ${res.status}`)
    const dest = path.join(work, 'blob', b.pathname)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()))
  }
  await fs.writeFile(path.join(work, 'manifest.json'), JSON.stringify({ blobs: blobs.map((b) => ({ pathname: b.pathname, size: b.size })) }))

  // 3) Tar + gzip the whole dir into a sibling file.
  const file = `${work}.tar.gz`
  await tar.create({ gzip: true, cwd: work, file }, ['db.json', 'manifest.json', 'blob'])
  const { size } = await fs.stat(file)
  await fs.rm(work, { recursive: true, force: true })
  return { file, size }
}

// Snapshot file name from the current time, e.g. vibeblog-2026-06-22T1530.tar.gz.
function snapshotName(): string {
  const iso = new Date().toISOString().replace(/:\d\d\.\d+Z$/, '').replace(/:/g, '')
  return `${SNAPSHOT_PREFIX}${iso}.tar.gz`
}

// Run one full snapshot: build → upload → prune to `keep`. Records the outcome.
export async function runBackup(): Promise<{ name: string; size: number }> {
  try {
    const { state, token } = await connect()
    const folderId = await ensureFolder(token, state.folderId)
    if (folderId !== state.folderId) await setFolderId(folderId)

    const { file, size } = await buildArchive()
    const name = snapshotName()
    try {
      await uploadSnapshot(token, folderId, name, await fs.readFile(file))
    } finally {
      await fs.rm(file, { force: true })
    }

    // Retention: keep the newest `keep`, delete the rest.
    const keep = (await getSettings()).backups.keep
    const snaps = await listSnapshots(token, folderId)
    for (const old of snaps.slice(keep)) await deleteSnapshot(token, old.id)

    await recordRun('success', null, size)
    return { name, size }
  } catch (error) {
    await recordRun('error', (error as Error).message, null)
    throw error
  }
}

// Cron entry: run only when enabled, connected, and the interval has elapsed.
export async function maybeRunBackup(): Promise<{ ran: boolean; name?: string }> {
  const { backups } = await getSettings()
  if (!backups.enabled) return { ran: false }
  const state = await getBackupState()
  if (!state.refreshToken) return { ran: false }
  const due = !state.lastRunAt || Date.now() - Date.parse(state.lastRunAt) >= backups.intervalDays * 86_400_000
  if (!due) return { ran: false }
  const { name } = await runBackup()
  return { ran: true, name }
}

// Snapshots currently on Drive (for the admin list). Empty when not connected.
export async function listBackups(): Promise<DriveFile[]> {
  const state = await getBackupState()
  if (!state.refreshToken || !state.folderId) return []
  return listSnapshots(await accessToken(state.refreshToken), state.folderId)
}

export async function deleteBackup(fileId: string): Promise<void> {
  const { token } = await connect()
  await deleteSnapshot(token, fileId)
}

// Restore a snapshot — DESTRUCTIVE. Replaces every text table (except settings,
// which is upserted by id=1) and re-uploads every blob. A pre-restore snapshot is
// taken first so the current state is recoverable. Surrogate `id`s are dropped on
// insert (tables key off slug/path/hash, so identity columns regenerate cleanly).
export async function restoreBackup(fileId: string): Promise<void> {
  const { token } = await connect()
  // Safety net: snapshot the live site before overwriting it.
  await runBackup().catch(() => {}) // best-effort; restore proceeds regardless

  const archive = path.join(os.tmpdir(), `vbrestore-${Date.now()}.tar.gz`)
  const work = `${archive}.dir`
  await fs.writeFile(archive, await downloadSnapshot(token, fileId))
  await fs.mkdir(work, { recursive: true })
  await tar.extract({ file: archive, cwd: work })

  const dump = JSON.parse(await fs.readFile(path.join(work, 'db.json'), 'utf8')) as { tables: Record<string, Record<string, unknown>[]> }
  for (const t of TABLES) {
    const rows = dump.tables[t] ?? []
    if (t === 'settings') {
      if (rows[0]) await db().from('settings').upsert(rows[0])
      continue
    }
    await db().from(t).delete().gte('id', 0) // clear table (all rows have id >= 0)
    if (rows.length) {
      // Drop server-managed columns so the insert is accepted: the surrogate `id`
      // (identity, regenerates) and `posts.search` (generated tsvector).
      const stripped = rows.map((r) => { const copy = { ...r }; delete copy.id; delete copy.search; return copy })
      for (let i = 0; i < stripped.length; i += 500) {
        const { error } = await db().from(t).insert(stripped.slice(i, i + 500))
        if (error) throw new Error(`restore ${t}: ${error.message}`)
      }
    }
  }

  // Re-upload every blob from the archive (overwrites; immutable names).
  const blobDir = path.join(work, 'blob')
  const walk = async (dir: string, base: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      const rel = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) await walk(abs, rel)
      else await uploadFile(rel, await fs.readFile(abs), mimeOf(rel))
    }
  }
  await walk(blobDir, '').catch((e) => { throw new Error(`restore blobs: ${(e as Error).message}`) })

  await fs.rm(archive, { force: true })
  await fs.rm(work, { recursive: true, force: true })
  revalidateEverything()
}
