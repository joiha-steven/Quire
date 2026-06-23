// Comments: text-only reader comments in the Postgres `comments` table. The public
// tree is rebuilt here (re-rooting orphans, tombstoning deleted-but-replied nodes)
// and rendered to SAFE html via comment-md — email is NEVER put in the public tree.
// Soft delete via `deleted_at` (Invariant 6), read live through `liveOnly()`.

import { cache } from 'react'
import type { AdminComment, CommentProvider, PublicComment } from '@/types'
import { db, liveOnly } from '@/lib/db'
import { renderCommentMarkdown } from '@/lib/comment-md'

export const MAX_COMMENT_LEN = 1000
const MAX_DEPTH = 2 // depth 0,1,2 => 3 reply tiers

// A row as stored (snake_case). Email is selected ONLY by admin reads.
export type CommentRow = {
  id: number
  post_slug: string
  parent_id: number | null
  depth: number
  author_name: string
  author_email?: string
  author_website: string | null
  provider: string
  content: string
  created_at: string
  deleted_at: string | null
}

function asProvider(p: string): CommentProvider {
  return p === 'google' || p === 'facebook' ? p : 'manual'
}

// ---- public read: the rendered comment tree for one post ---------------------

// Public projection (no email).
const PUBLIC_COLS = 'id,parent_id,author_name,author_website,provider,content,created_at,deleted_at'

// Recursively build one node. Returns null when a deleted node has no live reply
// (pruned); a deleted node WITH replies becomes a blanked tombstone.
function buildNode(row: CommentRow, childrenBy: Map<number, CommentRow[]>): PublicComment | null {
  const replies = (childrenBy.get(row.id) ?? [])
    .map((c) => buildNode(c, childrenBy))
    .filter((x): x is PublicComment => x !== null)
  const deleted = row.deleted_at !== null
  if (deleted && replies.length === 0) return null
  return {
    id: row.id,
    parentId: row.parent_id,
    name: deleted ? '' : row.author_name,
    website: deleted ? undefined : row.author_website || undefined,
    provider: asProvider(row.provider),
    contentHtml: deleted ? '' : renderCommentMarkdown(row.content),
    createdAt: row.created_at,
    deleted,
    replies,
  }
}

// Pure tree builder (no DB) — exported for tests. Input rows are oldest-first.
// Re-roots orphans (parent purged), prunes deleted leaves, tombstones the rest.
export function buildCommentTree(rows: CommentRow[]): PublicComment[] {
  const ids = new Set(rows.map((r) => r.id))
  const childrenBy = new Map<number, CommentRow[]>()
  const roots: CommentRow[] = []
  for (const r of rows) {
    // A row whose parent was purged (parent_id no longer present) re-roots to top.
    if (r.parent_id === null || !ids.has(r.parent_id)) roots.push(r)
    else (childrenBy.get(r.parent_id) ?? childrenBy.set(r.parent_id, []).get(r.parent_id)!).push(r)
  }
  return roots.map((r) => buildNode(r, childrenBy)).filter((x): x is PublicComment => x !== null)
}

// The full comment tree for a post (incl. tombstones), oldest-first at each level.
export const getCommentTree = cache(async (postSlug: string): Promise<PublicComment[]> => {
  try {
    // No liveOnly here: deleted rows are needed to render tombstones; pruning happens in buildNode.
    const { data, error } = await db()
      .from('comments')
      .select(PUBLIC_COLS)
      .eq('post_slug', postSlug)
      .order('created_at', { ascending: true })
    if (error || !data) {
      if (error) console.error(`[ERROR] comments.getCommentTree: ${error.message}`)
      return []
    }
    return buildCommentTree(data as CommentRow[])
  } catch (error) {
    console.error(`[ERROR] comments.getCommentTree: ${(error as Error).message}`)
    return []
  }
})

// ---- public write ------------------------------------------------------------

export type NewComment = {
  postSlug: string
  parentId: number | null
  name: string
  email: string
  website?: string
  provider: CommentProvider
  content: string
}

// Insert a comment. Validates the parent (must exist, be live, same post, depth <
// MAX_DEPTH) and derives depth server-side — the client is never trusted for it.
// Returns the new node ready to render (single, no replies). Throws on bad input.
export async function addComment(input: NewComment): Promise<PublicComment> {
  const content = input.content.trim().slice(0, MAX_COMMENT_LEN)
  if (!content) throw new Error('empty content')

  let depth = 0
  let postSlug = input.postSlug
  if (input.parentId !== null) {
    const { data: parent } = await db()
      .from('comments')
      .select('id,post_slug,depth,deleted_at')
      .eq('id', input.parentId)
      .maybeSingle()
    const p = parent as Pick<CommentRow, 'post_slug' | 'depth' | 'deleted_at'> | null
    if (!p || p.deleted_at !== null) throw new Error('parent not found')
    if (p.depth >= MAX_DEPTH) throw new Error('max reply depth reached')
    depth = p.depth + 1
    postSlug = p.post_slug // a reply always belongs to the parent's post
  }

  const { data, error } = await db()
    .from('comments')
    .insert({
      post_slug: postSlug,
      parent_id: input.parentId,
      depth,
      author_name: input.name,
      author_email: input.email,
      author_website: input.website || null,
      provider: input.provider,
      content,
    })
    .select(PUBLIC_COLS)
    .single()
  if (error || !data) throw new Error(`addComment: ${error?.message ?? 'no row'}`)
  const row = data as CommentRow
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.author_name,
    website: row.author_website || undefined,
    provider: asProvider(row.provider),
    contentHtml: renderCommentMarkdown(row.content),
    createdAt: row.created_at,
    deleted: false,
    replies: [],
  }
}

// ---- counts ------------------------------------------------------------------

// Live comment count for one post.
export async function countByPost(postSlug: string): Promise<number> {
  const { count } = await liveOnly(
    db().from('comments').select('id', { count: 'exact', head: true }).eq('post_slug', postSlug),
  )
  return count ?? 0
}

// slug -> live comment count, for the admin content table. One read, grouped in JS.
export const countsByPosts = cache(async (): Promise<Record<string, number>> => {
  try {
    const { data, error } = await liveOnly(db().from('comments').select('post_slug'))
    if (error || !data) return {}
    const out: Record<string, number> = {}
    for (const r of data as { post_slug: string }[]) out[r.post_slug] = (out[r.post_slug] ?? 0) + 1
    return out
  } catch (error) {
    console.error(`[ERROR] comments.countsByPosts: ${(error as Error).message}`)
    return {}
  }
})

// ---- admin reads (flat, include email + post title) --------------------------

const ADMIN_COLS = 'id,post_slug,author_name,author_email,author_website,provider,content,created_at,deleted_at'

// Map post slugs -> titles so the admin table can show which post a comment is on.
async function titlesFor(slugs: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(slugs)]
  if (unique.length === 0) return {}
  const { data } = await db().from('posts').select('slug,title').in('slug', unique)
  const out: Record<string, string> = {}
  for (const r of (data ?? []) as { slug: string; title: string }[]) out[r.slug] = r.title
  return out
}

function toAdmin(row: CommentRow, titles: Record<string, string>): AdminComment {
  return {
    id: row.id,
    postSlug: row.post_slug,
    postTitle: titles[row.post_slug] || row.post_slug,
    name: row.author_name,
    email: row.author_email ?? '',
    website: row.author_website || undefined,
    provider: asProvider(row.provider),
    content: row.content,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? undefined,
  }
}

// One page of LIVE comments, newest first, for the admin Comments table.
export async function getAdminComments(page = 1, perPage = 50): Promise<{ rows: AdminComment[]; total: number }> {
  try {
    const from = (Math.max(1, page) - 1) * perPage
    const { data, count, error } = await liveOnly(
      db().from('comments').select(ADMIN_COLS, { count: 'exact' }),
    )
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)
    if (error || !data) {
      if (error) console.error(`[ERROR] comments.getAdminComments: ${error.message}`)
      return { rows: [], total: 0 }
    }
    const rows = data as CommentRow[]
    const titles = await titlesFor(rows.map((r) => r.post_slug))
    return { rows: rows.map((r) => toAdmin(r, titles)), total: count ?? rows.length }
  } catch (error) {
    console.error(`[ERROR] comments.getAdminComments: ${(error as Error).message}`)
    return { rows: [], total: 0 }
  }
}

// Trashed comments (most-recently-deleted first) for the Trash view.
export async function getTrashedComments(): Promise<AdminComment[]> {
  try {
    const { data, error } = await db()
      .from('comments')
      .select(ADMIN_COLS)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] comments.getTrashedComments: ${error.message}`)
      return []
    }
    const rows = data as CommentRow[]
    const titles = await titlesFor(rows.map((r) => r.post_slug))
    return rows.map((r) => toAdmin(r, titles))
  } catch (error) {
    console.error(`[ERROR] comments.getTrashedComments: ${(error as Error).message}`)
    return []
  }
}

// ---- mutations ---------------------------------------------------------------

// Soft-delete (Trash): live replies survive and the node renders as a tombstone.
export async function softDeleteComment(id: number): Promise<void> {
  await db().from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
}

export async function restoreComment(id: number): Promise<void> {
  await db().from('comments').update({ deleted_at: null }).eq('id', id)
}

// Hard delete one comment (Trash purge). Any live child re-roots to top on read.
export async function purgeComment(id: number): Promise<void> {
  await db().from('comments').delete().eq('id', id)
}

// Permanently remove EVERY trashed comment. Returns the count.
export async function emptyCommentsTrash(): Promise<number> {
  const trashed = await getTrashedComments()
  if (trashed.length === 0) return 0
  await db().from('comments').delete().in('id', trashed.map((c) => c.id))
  return trashed.length
}

// Move a post's comments when its slug changes (called from savePost's rename path).
export async function renameComments(oldSlug: string, newSlug: string): Promise<void> {
  await db().from('comments').update({ post_slug: newSlug }).eq('post_slug', oldSlug)
}

// Hard-delete every comment of a post (called when the post itself is purged).
export async function deleteCommentsForPost(postSlug: string): Promise<void> {
  await db().from('comments').delete().eq('post_slug', postSlug)
}
