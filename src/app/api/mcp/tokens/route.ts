// GET  /api/mcp/tokens -> list MCP tokens (metadata only; owner only).
// POST /api/mcp/tokens -> create a named token, returns the plaintext ONCE (owner only).

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { listTokens, createToken } from '@/lib/mcp/tokens'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const tokens = await listTokens()
    logRequest(req, 200, start)
    return ok(tokens)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to list tokens', 500)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { name?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      logRequest(req, 400, start)
      return fail('Name is required', 400)
    }
    try {
      const { token, info } = await createToken(name)
      after(() => logActivity('mcp.token.create', info.name))
      logRequest(req, 201, start)
      return ok({ token, info }, 201) // plaintext returned ONCE
    } catch (e) {
      if ((e as Error).message === 'token_limit') {
        logRequest(req, 409, start)
        return fail('token_limit', 409)
      }
      throw e
    }
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to create token', 500)
  }
}
