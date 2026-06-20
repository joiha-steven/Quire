// POST /api/taxonomy -> rename or remove a category/tag across all posts (owner only).
// Body: { kind: 'category'|'tag', name: string, action: 'rename'|'delete', newName?: string }
import type { NextRequest } from 'next/server'
import { updateTerm, type TermKind } from '@/lib/posts'
import { revalidateEverything } from '@/lib/revalidate'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Rewriting many posts' markdown can take a while on a large blog.
export const maxDuration = 60

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json()) as { kind?: string; name?: string; action?: string; newName?: string }
    const kind: TermKind | null = body.kind === 'tag' ? 'tag' : body.kind === 'category' ? 'category' : null
    const name = body.name?.trim()
    if (!kind || !name) {
      logRequest(req, 400, start)
      return fail('kind and name are required', 400)
    }
    const newName = body.action === 'rename' ? (body.newName?.trim() ?? '') : null
    if (body.action === 'rename' && !newName) {
      logRequest(req, 400, start)
      return fail('newName is required to rename', 400)
    }
    const changed = await updateTerm(kind, name, newName)
    revalidateEverything()
    logRequest(req, 200, start)
    return ok({ changed })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to update taxonomy', 500)
  }
}
