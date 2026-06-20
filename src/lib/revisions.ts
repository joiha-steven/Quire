// Post "time machine": keep the last few overwritten versions of a post so the
// editor can restore one. Snapshots live at revisions/{slug}.json (newest first)
// — deterministic pathname, no DB, same Blob pattern as the rest of the app.

import type { PostWithContent, PostRevision } from '@/types'
import { readJson, writeJson, deleteByPathname } from '@/lib/blob'

const MAX_REVISIONS = 3
const revPath = (slug: string) => `revisions/${slug}.json`

// Newest-first list of snapshots for a post (empty when none).
export async function getRevisions(slug: string): Promise<PostRevision[]> {
  return readJson<PostRevision[]>(revPath(slug), [])
}

// Snapshot a version that is about to be overwritten. Prepends it (newest first)
// and trims to MAX_REVISIONS. Skips a snapshot identical to the latest one so a
// no-op autosave never evicts a genuinely older version.
export async function pushRevision(previous: PostWithContent): Promise<void> {
  const list = await readJson<PostRevision[]>(revPath(previous.slug), [])
  const top = list[0]
  if (top && top.content === previous.content && top.title === previous.title) return
  const next = [{ savedAt: new Date().toISOString(), ...previous }, ...list].slice(0, MAX_REVISIONS)
  await writeJson(revPath(previous.slug), next)
}

// Move a post's revisions when its slug changes (keep history attached).
export async function renameRevisions(from: string, to: string): Promise<void> {
  if (from === to) return
  const list = await readJson<PostRevision[]>(revPath(from), [])
  if (!list.length) return
  await writeJson(revPath(to), list)
  await deleteByPathname(revPath(from))
}

// Drop all revisions for a post (called when the post itself is deleted).
export async function deleteRevisions(slug: string): Promise<void> {
  await deleteByPathname(revPath(slug))
}
