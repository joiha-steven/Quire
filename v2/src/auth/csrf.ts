// Cross-site request forgery, defended with headers rather than a token table.
//
// `SameSite=Lax` on the session cookie already blocks the classic attack: a form on
// another origin POSTing to us arrives without the cookie, so it is simply unauthenticated.
// What follows is the second layer, for the cases Lax does not cover — an older browser, a
// same-site-but-not-same-origin subdomain, a future cookie mistake.
//
// No hidden field, no token table, no per-form state to expire or get out of sync. The
// browser is already telling us where the request came from; the job is to insist on it.

import type { Context } from 'hono'

export type OriginCheck = { ok: true } | { ok: false; reason: 'cross-site' | 'no-origin' }

/**
 * Accept a state-changing request only when the browser vouches for its provenance.
 *
 * `Sec-Fetch-Site` is the authoritative signal where it exists — the browser sets it and
 * script cannot. `Origin` is the fallback for anything not sending it. A request with
 * NEITHER is rejected: that combination is a non-browser client, which has the API token
 * path available and no business on a cookie-authenticated route.
 */
export function checkOrigin(c: Context): OriginCheck {
  const fetchSite = c.req.header('sec-fetch-site')
  if (fetchSite !== undefined) {
    // `none` is a direct navigation (typed URL, bookmark), which cannot be a POST from
    // another page. `same-origin` is us. Everything else is somebody else.
    return fetchSite === 'same-origin' || fetchSite === 'none'
      ? { ok: true }
      : { ok: false, reason: 'cross-site' }
  }

  const origin = c.req.header('origin')
  if (origin === undefined) return { ok: false, reason: 'no-origin' }

  // Compared against the HOST the request actually arrived on, not against a configured
  // site URL. Behind a proxy those differ, and a mismatch there would reject every
  // legitimate request while a matching one proves nothing extra.
  const host = c.req.header('host')
  if (host === undefined) return { ok: false, reason: 'no-origin' }
  try {
    return new URL(origin).host === host ? { ok: true } : { ok: false, reason: 'cross-site' }
  } catch {
    return { ok: false, reason: 'cross-site' }
  }
}

/** Methods that change state, and therefore need the check above. */
export function isStateChanging(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}
