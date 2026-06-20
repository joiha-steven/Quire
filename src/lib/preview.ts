// Shareable draft-preview tokens. A token is an HMAC of the slug keyed by
// AUTH_SECRET, so anyone with the link can view that one draft (and only it)
// without signing in, and the link can't be guessed or reused for other slugs.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function previewToken(slug: string): string {
  const secret = process.env.AUTH_SECRET ?? ''
  return createHmac('sha256', secret).update(slug).digest('base64url').slice(0, 24)
}

export function verifyPreview(slug: string, token: string | undefined): boolean {
  if (!token) return false
  const expected = previewToken(slug)
  if (token.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}
