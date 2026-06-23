// POST /api/trash -> act on trashed (soft-deleted) items (owner only).
// Body: { kind: 'posts'|'pages'|'media'|'files', action: 'restore'|'purge'|'empty', ids?: string[] }
// - ids are slugs (posts/pages) or urls (media/files); ignored for 'empty'.
// The Trash list itself is server-rendered by /admin/trash, so there is no GET here.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { restorePost, purgePost, emptyPostsTrash } from '@/lib/posts'
import { restorePage, purgePage, emptyPagesTrash } from '@/lib/pages'
import { restoreMediaBatch, purgeMediaBatch, emptyMediaTrash } from '@/lib/media'
import { restoreFilesBatch, purgeFilesBatch, emptyFilesTrash } from '@/lib/files'
import { restoreComment, purgeComment, emptyCommentsTrash } from '@/lib/comments'
import { revalidatePost, revalidatePage, revalidateEverything } from '@/lib/revalidate'
import { logActivity, type ActivityAction } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const maxDuration = 60 // emptying a large trash may delete many blobs

type Kind = 'posts' | 'pages' | 'media' | 'files' | 'comments'
type Action = 'restore' | 'purge' | 'empty'
const KINDS: Kind[] = ['posts', 'pages', 'media', 'files', 'comments']
const ACTIONS: Action[] = ['restore', 'purge', 'empty']
// Activity-log uses singular per-kind verbs (matching the existing actions).
const SINGULAR: Record<Kind, string> = { posts: 'post', pages: 'page', media: 'media', files: 'file', comments: 'comment' }

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown; action?: unknown; ids?: unknown }
    const kind = body.kind as Kind
    const action = body.action as Action
    if (!KINDS.includes(kind) || !ACTIONS.includes(action)) {
      logRequest(req, 400, start)
      return fail('Invalid kind or action', 400)
    }
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []
    if (action !== 'empty' && ids.length === 0) {
      logRequest(req, 400, start)
      return fail('No ids provided', 400)
    }

    let count = ids.length
    switch (kind) {
      case 'posts':
        if (action === 'restore') {
          await Promise.all(ids.map(restorePost))
          ids.forEach((slug) => revalidatePost(slug)) // bring its page + list surfaces back
        } else if (action === 'purge') {
          await Promise.all(ids.map(purgePost))
        } else {
          count = await emptyPostsTrash()
        }
        break
      case 'pages':
        if (action === 'restore') {
          await Promise.all(ids.map(restorePage))
          ids.forEach((slug) => revalidatePage(slug))
        } else if (action === 'purge') {
          await Promise.all(ids.map(purgePage))
        } else {
          count = await emptyPagesTrash()
        }
        break
      case 'media':
        if (action === 'restore') await restoreMediaBatch(ids)
        else if (action === 'purge') { await purgeMediaBatch(ids); revalidateEverything() }
        else { count = await emptyMediaTrash(); revalidateEverything() }
        break
      case 'files':
        if (action === 'restore') await restoreFilesBatch(ids)
        else if (action === 'purge') await purgeFilesBatch(ids)
        else count = await emptyFilesTrash()
        break
      case 'comments':
        // No revalidatePath: the public list is client-fetched (no-store).
        if (action === 'restore') await Promise.all(ids.map((id) => restoreComment(Number(id))))
        else if (action === 'purge') await Promise.all(ids.map((id) => purgeComment(Number(id))))
        else count = await emptyCommentsTrash()
        break
    }

    const logAction = (action === 'empty' ? 'trash.empty' : `${SINGULAR[kind]}.${action}`) as ActivityAction
    after(() => logActivity(logAction, action === 'empty' ? `${kind}: ${count} item(s)` : ids.join(', ')))
    logRequest(req, 200, start)
    return ok({ kind, action, count })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Trash action failed', 500)
  }
}
