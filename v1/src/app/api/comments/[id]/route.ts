// DELETE /api/comments/[id] -> soft-delete a comment (owner only). The comment
// moves to Trash (restore/purge live there). Public lists are client-fetched with
// no-store, so the comment disappears on the next load — no revalidatePath needed.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { softDeleteComment } from '@/lib/comments'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/comments/[id]'>): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { id } = await ctx.params
    const numId = Number(id)
    if (!Number.isInteger(numId)) {
      logRequest(req, 400, start)
      return fail('Invalid comment id', 400)
    }
    await softDeleteComment(numId)
    after(() => logActivity('comment.delete', String(numId)))
    logRequest(req, 200, start)
    return ok({ id: numId })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete comment', 500)
  }
}
