import { describe, it, expect } from 'vitest'

// Pure guards on the backup table set + the per-table CLEAR filter map. These pin two
// bugs that only surface on a NON-EMPTY restore (an empty-DB restore happens to pass):
//
//   1. `posts`/`pages`/`media`/`files` have NO `id` column (PKs are slug/path/url), so
//      clearing them with `.gte('id', 0)` errors (PostgREST 42703) and silently leaves
//      them un-cleared → the re-insert then hits the existing PKs and throws. The clear
//      filter for those tables MUST target their real PK, never `id`.
//   2. `comments` was missing from TABLES → snapshots captured zero comments and a
//      restore wiped them. It must be present (and ordered after `posts`, which it
//      references via `post_slug`).
//
// The module's other imports (db/blob/gdrive/tar/…) are server-only; mock them so this
// pure import stays free of any runtime/env coupling — we only assert the two constants.
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

import { TABLES, CLEAR_BY_PK } from '@/lib/backup'

// The four tables with NO `id` column — clearing them by `id` is the bug.
const ID_LESS = ['posts', 'pages', 'media', 'files'] as const

describe('backup: per-table clear-filter map (non-empty restore)', () => {
  it('clears posts/pages/media/files by their real PK, never by `id`', () => {
    for (const t of ID_LESS) {
      const pk = CLEAR_BY_PK[t]
      expect(pk, `${t} must have an explicit clear filter`).toBeDefined()
      expect(pk?.col).not.toBe('id')
    }
    // The exact PK column per the schema (slug / path / url).
    expect(CLEAR_BY_PK.posts?.col).toBe('slug')
    expect(CLEAR_BY_PK.pages?.col).toBe('slug')
    expect(CLEAR_BY_PK.media?.col).toBe('path')
    expect(CLEAR_BY_PK.files?.col).toBe('url')
  })

  it('leaves id-keyed tables (e.g. comments, post_revisions) to the default id filter', () => {
    expect(CLEAR_BY_PK.comments).toBeUndefined()
    expect(CLEAR_BY_PK.post_revisions).toBeUndefined()
  })
})

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
