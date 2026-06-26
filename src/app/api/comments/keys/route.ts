// POST /api/comments/keys -> store the optional Turnstile keys (owner only).
// SECRETS — kept in the server-only `integration_keys` table, NOT in
// settings.data (which is sent to the client). Only non-empty fields are sent by
// the admin form, so a blank input never clears an existing key.

import type { NextRequest } from 'next/server'
import { saveIntegrationKeys, type IntegrationKeys } from '@/lib/integration-keys'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as Partial<IntegrationKeys>
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
    await saveIntegrationKeys({
      turnstileSiteKey: str(body.turnstileSiteKey),
      turnstileSecretKey: str(body.turnstileSecretKey),
    })
    logRequest(req, 200, start)
    return ok({ saved: true })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to save keys', 500)
  }
}
