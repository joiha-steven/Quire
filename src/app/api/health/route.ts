// GET /api/health — liveness/readiness probe for a reverse proxy or orchestrator.
// Public + unauthenticated (allow-listed in middleware): checks the two hard
// dependencies — Postgres reachable (a trivial read) and the local store writable —
// and returns 200 when both pass, 503 otherwise. Never cached.

import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { logRequest } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

async function checkDb(): Promise<boolean> {
  try {
    const { error } = await db().from('settings').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

async function checkStorage(): Promise<boolean> {
  try {
    // Dynamic-import node:fs (mirrors the blob-local facade) so the static file-trace
    // for this route stays small — a top-level fs import traces the whole project.
    const { access, constants } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    await access(resolve(process.env.STORAGE_LOCAL_DIR || './uploads'), constants.W_OK)
    return true
  } catch {
    return false
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  const [database, storage] = await Promise.all([checkDb(), checkStorage()])
  const healthy = database && storage
  logRequest(req, healthy ? 200 : 503, start)
  return Response.json(
    { status: healthy ? 'ok' : 'degraded', checks: { database, storage } },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
