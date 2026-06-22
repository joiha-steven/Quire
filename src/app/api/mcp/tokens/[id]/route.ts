// DELETE /api/mcp/tokens/[id] -> permanently revoke one MCP token (owner only).

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { deleteToken } from '@/lib/mcp/tokens'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { id } = await ctx.params
    const n = Number(id)
    if (!Number.isInteger(n)) {
      logRequest(req, 400, start)
      return fail('Invalid id', 400)
    }
    await deleteToken(n)
    after(() => logActivity('mcp.token.delete', id))
    logRequest(req, 200, start)
    return ok({ id: n })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete token', 500)
  }
}
