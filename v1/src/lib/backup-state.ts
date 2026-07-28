// Backup secrets + run state — SERVER-ONLY. The Google Drive refresh token is a
// secret and is deliberately kept OUT of `settings.data` (which is sent to the
// admin client). Only the non-secret config (enabled/interval/keep) lives in
// settings; the token, the Drive folder id, and last-run state live here in the
// `backup_state` table (single row id=1). Never import this from a client component.

import { revalidateTag } from 'next/cache'
import { db, DB_TAG } from '@/lib/db'

export type BackupState = {
  refreshToken: string | null
  folderId: string | null
  lastRunAt: string | null
  lastStatus: 'success' | 'error' | null
  lastError: string | null
  lastSize: number | null
}

// What the admin UI may see — the token itself is NEVER included.
export type BackupStatus = {
  connected: boolean // a Drive refresh token is stored
  lastRunAt: string | null
  lastStatus: 'success' | 'error' | null
  lastError: string | null
  lastSize: number | null
}

type Row = {
  refresh_token: string | null
  folder_id: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
  last_size: number | null
}

const EMPTY: BackupState = {
  refreshToken: null,
  folderId: null,
  lastRunAt: null,
  lastStatus: null,
  lastError: null,
  lastSize: null,
}

export async function getBackupState(): Promise<BackupState> {
  try {
    const { data } = await db()
      .from('backup_state')
      .select('refresh_token,folder_id,last_run_at,last_status,last_error,last_size')
      .eq('id', 1)
      .maybeSingle()
    if (!data) return EMPTY
    const r = data as Row
    return {
      refreshToken: r.refresh_token,
      folderId: r.folder_id,
      lastRunAt: r.last_run_at,
      lastStatus: r.last_status === 'success' || r.last_status === 'error' ? r.last_status : null,
      lastError: r.last_error,
      lastSize: r.last_size === null ? null : Number(r.last_size),
    }
  } catch (error) {
    console.error(`[ERROR] backup-state.getBackupState: ${(error as Error).message}`)
    return EMPTY
  }
}

// Client-safe view: connection + last-run, never the token.
export function toStatus(s: BackupState): BackupStatus {
  return {
    connected: !!s.refreshToken,
    lastRunAt: s.lastRunAt,
    lastStatus: s.lastStatus,
    lastError: s.lastError,
    lastSize: s.lastSize,
  }
}

// Store the Drive refresh token (from the consent callback). folderId stays as-is.
export async function setDriveAuth(refreshToken: string): Promise<void> {
  await db().from('backup_state').upsert({ id: 1, refresh_token: refreshToken })
  revalidateTag(DB_TAG, 'max') // bust the cached read so the admin sees "connected" at once
}

// Remember the snapshot folder once created so we reuse it.
export async function setFolderId(folderId: string): Promise<void> {
  await db().from('backup_state').upsert({ id: 1, folder_id: folderId })
  revalidateTag(DB_TAG, 'max')
}

// Disconnect Drive: forget the token + folder (snapshots already on Drive stay).
export async function clearDriveAuth(): Promise<void> {
  await db().from('backup_state').upsert({ id: 1, refresh_token: null, folder_id: null })
  revalidateTag(DB_TAG, 'max')
}

// Stamp the outcome of a backup run for the admin status panel.
export async function recordRun(status: 'success' | 'error', error: string | null, size: number | null): Promise<void> {
  await db().from('backup_state').upsert({
    id: 1,
    last_run_at: new Date().toISOString(),
    last_status: status,
    last_error: error,
    last_size: size,
  })
  revalidateTag(DB_TAG, 'max')
}
