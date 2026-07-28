// Shareable draft-preview tokens. A token is an HMAC of the slug, so anyone holding the
// link can view that ONE draft without signing in, and the link cannot be guessed or
// reused for another slug.
//
// The key was `process.env.AUTH_SECRET ?? ''`. `AUTH_SECRET` left with next-auth
// (06-auth.md), which silently made the key the EMPTY STRING — every preview token then
// signed with a key an attacker also has, so any draft slug's token is computable and
// every unpublished post is readable by anyone who guesses the slug. Found by auditing
// which environment variables the server still needs, not by a test.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverSecret } from '@/auth/secret'

export function previewToken(slug: string): string {
  return createHmac('sha256', serverSecret('preview-link')).update(slug).digest('base64url').slice(0, 24)
}

export function verifyPreview(slug: string, token: string | undefined): boolean {
  if (!token) return false
  const expected = previewToken(slug)
  if (token.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}
