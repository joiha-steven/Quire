// Shared helpers for API route handlers: uniform envelope, auth guard, logging.

import { after, type NextRequest } from 'next/server'
import type { ApiResponse } from '@/types'
import { getAuthState } from '@/lib/auth'
import { logActivityError } from '@/lib/activity'

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } satisfies ApiResponse<T>, { status })
}

export function fail(error: string, status = 400): Response {
  return Response.json({ success: false, error } satisfies ApiResponse, { status })
}

// Standard request/response log line.
export function logRequest(req: NextRequest, status: number, start: number): void {
  const { pathname } = new URL(req.url)
  console.log(`[${req.method}] ${pathname} — ${status} — ${Date.now() - start}ms`) // check:allow-console -- intentional request access log
}

// Standard error log line + an `error` entry in the activity log (the error log),
// scheduled after the response so it never delays the request. Guarded so a logging
// failure (or being outside a request scope) can never break the error path.
export function logError(req: NextRequest, error: unknown): void {
  const { pathname } = new URL(req.url)
  const message = (error as Error).message
  console.error(`[ERROR] ${pathname}: ${message}`)
  try {
    after(() => logActivityError(`${req.method} ${pathname}`, message))
  } catch {
    /* not in a request scope — console line above is enough */
  }
}

// Returns true when the current session is the authorized owner.
export async function requireOwner(): Promise<boolean> {
  const { authorized } = await getAuthState()
  return authorized
}
