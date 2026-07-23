// POST /api/mail — save the SMTP config (owner only). Secrets land on integration_keys,
// never in settings.data. Passing a field is optional; '' clears it (env fallback).

import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { saveSmtpConfig, getSmtpConfig, isMailConfigured, type SmtpConfig } from '@/lib/mail'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Non-secret SMTP status for the admin form (host/port/user/from/secure + configured);
// the password is never returned.
export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const c = await getSmtpConfig()
    logRequest(req, 200, start)
    return ok({
      host: c.host,
      port: c.port,
      user: c.user,
      from: c.from,
      secure: c.secure,
      hasPass: !!c.pass,
      configured: isMailConfigured(c),
    })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read mail config', 500)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const patch: Partial<SmtpConfig> = {}
    if (typeof body.host === 'string') patch.host = body.host
    if (typeof body.user === 'string') patch.user = body.user
    if (typeof body.pass === 'string') patch.pass = body.pass
    if (typeof body.from === 'string') patch.from = body.from
    if (typeof body.port === 'number') patch.port = body.port
    if (typeof body.secure === 'boolean') patch.secure = body.secure
    await saveSmtpConfig(patch)
    after(() => logActivity('mail.config'))
    logRequest(req, 200, start)
    return ok({ ok: true })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to save mail config', 500)
  }
}
