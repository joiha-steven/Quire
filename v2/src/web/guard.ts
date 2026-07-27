// Invariant 4, made structural: a write route is protected because of WHERE it is
// mounted, not because its handler remembered to check.
//
// The frozen tree called `requireOwner()` as the first line of each handler, and the
// failure mode was exactly what you would expect — one route that did not. Here the check
// is middleware on a router group, so forgetting it is not a line you can omit; it is a
// route you would have to deliberately mount somewhere else.

import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { COOKIE_NAME, resolveSession, type SessionRow } from '@/auth/sessions'
import { checkOrigin, isStateChanging } from '@/auth/csrf'
import { getUser, type PublicUser } from '@/auth/users'

/** What the gate puts on the context for handlers behind it. */
export type Owner = { user: PublicUser; session: SessionRow }

// Hono's context variable map. Declared here so `c.get('owner')` is typed everywhere
// rather than cast at each call site.
export type OwnerEnv = { Variables: { owner: Owner } }

/**
 * The current owner, or null. Safe to call anywhere, including on public routes that
 * merely want to know (the preview banner, the admin link in the footer).
 */
export function currentOwner(c: Context): Owner | null {
  const session = resolveSession(getCookie(c, COOKIE_NAME))
  if (session === null) return null
  const user = getUser(session.userId)
  // A session whose user was deleted. Not an error, just not an owner.
  return user === null ? null : { user, session }
}

/**
 * Reject anything not signed in, and any state-changing request that cannot prove where
 * it came from.
 *
 * The CSRF check lives HERE rather than as separate middleware, because the two belong
 * together: a cookie-authenticated write is exactly the request that needs both, and
 * splitting them creates the possibility of mounting one without the other.
 */
export function requireOwner(): MiddlewareHandler<OwnerEnv> {
  return async (c, next) => {
    if (isStateChanging(c.req.method)) {
      const origin = checkOrigin(c)
      if (!origin.ok) {
        // 403, not 401: signing in would not help, and a 401 invites a client to retry
        // with credentials it already sent.
        return c.json({ error: 'Cross-site request rejected' }, 403)
      }
    }

    const owner = currentOwner(c)
    if (owner === null) return c.json({ error: 'Unauthorized' }, 401)

    c.set('owner', owner)
    await next()
  }
}

/**
 * A router group behind the gate. Mount API routes on the result and they are protected
 * by construction.
 *
 * The gate is applied at construction rather than left to the caller, so there is no
 * ownerRouter() that someone can create and then forget to guard.
 */
export function ownerRouter(): Hono<OwnerEnv> {
  const router = new Hono<OwnerEnv>()
  router.use('*', requireOwner())
  return router
}
