import { describe, it, expect } from 'vitest'

// Pure guards on the backup table SET (the restore itself is now one transactional
// `restore_tables` RPC, so the old per-table clear-filter map is gone). Pins that:
//   1. `comments` is present (was once missing → snapshots captured zero comments and a
//      restore wiped them) and ordered after `posts` (it references post_slug).
//   2. the secret-bearing tables are excluded so secrets never ship in a snapshot.
//
// The module's other imports (db/blob/gdrive/tar/…) are server-only; mock them so this
// pure import stays free of any runtime/env coupling — we only assert the constant.
import { vi } from 'vitest'
vi.mock('@/lib/db', () => ({ db: () => ({}), DB_TAG: 'db' }))
vi.mock('@/lib/blob', () => ({ readBlob: vi.fn(), listBlobs: vi.fn(), uploadFile: vi.fn() }))
vi.mock('@/lib/settings', () => ({ getSettings: vi.fn() }))
vi.mock('@/lib/backup-state', () => ({ getBackupState: vi.fn(), setFolderId: vi.fn(), recordRun: vi.fn() }))
vi.mock('@/lib/gdrive', () => ({
  accessToken: vi.fn(), ensureFolder: vi.fn(), listSnapshots: vi.fn(),
  uploadSnapshot: vi.fn(), deleteSnapshot: vi.fn(), downloadSnapshot: vi.fn(),
}))
vi.mock('@/lib/revalidate', () => ({ revalidateEverything: vi.fn() }))
vi.mock('tar', () => ({ create: vi.fn(), extract: vi.fn() }))

import { TABLES } from '@/lib/backup'

describe('backup: TABLES coverage', () => {
  it('includes `comments` so reader comments are backed up (and not wiped on restore)', () => {
    expect(TABLES).toContain('comments')
  })

  it('orders `comments` after `posts` (it references post_slug)', () => {
    expect(TABLES.indexOf('comments')).toBeGreaterThan(TABLES.indexOf('posts'))
  })

  it('excludes the secret-bearing tables (backup_state, integration_keys)', () => {
    expect(TABLES).not.toContain('backup_state')
    expect(TABLES).not.toContain('integration_keys')
  })
})
