// Shared shapes for the JSON endpoints, and the one place a request gets logged.
//
// The frozen tree called `logRequest(req, status, start)` at the end of every handler,
// including inside each early return. That is a rule enforced by remembering it, and the
// failure mode is a route that silently logs nothing. Here it is middleware: a request is
// timed and logged because it went through the router, not because its handler remembered
// to. Same idea as Invariant 4 gating writes by router-group membership.

import type { Context, MiddlewareHandler } from 'hono'

/** A successful JSON body. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** A failure, in the one shape every client can rely on. */
export function fail(c: Context, message: string, status = 400): Response {
  return c.json({ error: message }, status as 400)
}

/**
 * Time and log every request.
 *
 * Slow requests are the ones worth seeing, so the line carries the duration. 4xx and 5xx
 * are logged at error level: on a single-tenant blog the log IS the monitoring.
 */
export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now()
    await next()
    const ms = Math.round(performance.now() - start)
    const line = `${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`
    if (c.res.status >= 400) console.error(`[ERROR] ${line}`)
    else console.log(line)
  }
}
