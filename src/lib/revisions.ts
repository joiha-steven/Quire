// Post "time machine": keep the last few overwritten versions of a post so the
// editor can restore one. Snapshots live in the `post_revisions` table (newest
// first), one row per snapshot: `data` jsonb holds the store-relative
// PostWithContent, `saved_at` the timestamp.

import type { PostWithContent, PostRevision } from '@/types'
import { collapseBlob, expandBlob } from '@/lib/blob'
import { db } from '@/lib/db'

const MAX_REVISIONS = 3

// Store-relative snapshot of a post (image refs collapsed to pathnames), so
// revisions carry no Blob host — same portability rule as the live tables.
function collapseSnapshot(p: PostWithContent): PostWithContent {
  return {
    ...p,
    featuredImage: p.featuredImage ? collapseBlob(p.featuredImage) : undefined,
    content: collapseBlob(p.content),
  }
}

// Re-expand a stored snapshot into absolute URLs for the editor / audits.
function expandSnapshot(data: PostWithContent, savedAt: string): PostRevision {
  return {
    ...data,
    featuredImage: data.featuredImage ? expandBlob(data.featuredImage) : undefined,
    content: expandBlob(data.content ?? ''),
    savedAt,
  }
}

// Newest-first list of snapshots for a post (empty when none).
export async function getRevisions(slug: string): Promise<PostRevision[]> {
  const { data, error } = await db()
    .from('post_revisions')
    .select('data, saved_at')
    .eq('slug', slug)
    .order('saved_at', { ascending: false })
  if (error || !data) return []
  return data.map((r) => expandSnapshot(r.data as PostWithContent, r.saved_at as string))
}

// Snapshot a version that is about to be overwritten. Inserts it and trims to
// MAX_REVISIONS. Skips a snapshot identical to the latest one so a no-op autosave
// never evicts a genuinely older version.
export async function pushRevision(previous: PostWithContent): Promise<void> {
  const snapshot = collapseSnapshot(previous)
  const { data: latest } = await db()
    .from('post_revisions')
    .select('data')
    .eq('slug', previous.slug)
    .order('saved_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const top = latest?.data as PostWithContent | undefined
  if (top && top.content === snapshot.content && top.title === snapshot.title) return

  await db().from('post_revisions').insert({ slug: previous.slug, data: snapshot })

  // Trim: keep only the newest MAX_REVISIONS rows for this slug.
  const { data: rows } = await db()
    .from('post_revisions')
    .select('id')
    .eq('slug', previous.slug)
    .order('saved_at', { ascending: false })
  if (rows && rows.length > MAX_REVISIONS) {
    const stale = rows.slice(MAX_REVISIONS).map((r) => r.id as number)
    await db().from('post_revisions').delete().in('id', stale)
  }
}

// Move a post's revisions when its slug changes (keep history attached).
export async function renameRevisions(from: string, to: string): Promise<void> {
  if (from === to) return
  await db().from('post_revisions').update({ slug: to }).eq('slug', from)
}

// Drop all revisions for a post (called when the post itself is deleted).
export async function deleteRevisions(slug: string): Promise<void> {
  await db().from('post_revisions').delete().eq('slug', slug)
}
