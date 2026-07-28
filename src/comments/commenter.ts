// Who a reader is, once they have signed in with Google to comment.
//
// This is NOT the owner's session. The owner's is a row in `sessions` with a hashed token,
// because it can do anything and therefore has to be revocable one by one. A commenter's
// grants exactly one thing: their name and address are filled in for them and Turnstile is
// skipped. That is worth a signed cookie and NOT worth a table, a purge sweep and a write
// on every reader's first comment.
//
// So the cookie IS the session: a small JSON payload with an expiry, plus an HMAC over it
// keyed by a secret the server generated for itself. Nothing in it is trusted until the
// signature verifies, and a payload past its expiry is refused even when it does.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverSecret } from '@/auth/secret'

/**
 * `__Host-` is enforced by the browser, not by us: the cookie must be Secure, must have
 * `Path=/`, and must carry no `Domain`. It is therefore impossible for a subdomain to set
 * it, which is the attack the prefix exists to close.
 */
export const COMMENTER_COOKIE = '__Host-quire_commenter'

/** Thirty days. Long enough to be worth signing in; short enough that a stale one lapses. */
const MAX_AGE_S = 30 * 24 * 60 * 60

export type Commenter = {
  name: string
  email: string
  provider: 'google'
}

type Payload = Commenter & { exp: number }

const b64 = (b: Buffer | string): string => Buffer.from(b as string).toString('base64url')

function sign(body: string): string {
  return createHmac('sha256', serverSecret('commenter-session')).update(body).digest('base64url')
}

/** A signed cookie VALUE for this commenter, valid for `MAX_AGE_S`. */
export function issueCommenter(who: Commenter): string {
  const payload: Payload = { ...who, exp: Date.now() + MAX_AGE_S * 1000 }
  const body = b64(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

/**
 * The commenter a cookie value names, or null.
 *
 * Compared with `timingSafeEqual`, like every other signature check here: a plain `===`
 * returns on the first differing byte, and the difference is measurable often enough that
 * forging a signature one byte at a time is a real technique rather than a theoretical one.
 */
export function readCommenter(value: string | undefined): Commenter | null {
  if (!value) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null

  const body = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1))
  const expected = Buffer.from(sign(body))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Payload
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    if (!payload.email || !payload.name || payload.provider !== 'google') return null
    return { name: payload.name, email: payload.email, provider: 'google' }
  } catch {
    return null
  }
}

/**
 * SameSite=Lax, not Strict. The reader arrives back here as a top-level navigation FROM
 * Google, and Strict withholds the cookie on exactly that: they would land on the post
 * signed in, and be signed out again the moment the page read the cookie.
 */
export function commenterCookie(value: string): string {
  return `${COMMENTER_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_S}`
}

export function clearedCommenterCookie(): string {
  return `${COMMENTER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}
