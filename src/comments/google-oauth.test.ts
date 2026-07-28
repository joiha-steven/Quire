// The claim checks are the entire security of comment sign-in, because the signature is
// deliberately not verified (see `identityFromIdToken`). Each one gets its own case.
import { describe, expect, it } from 'bun:test'
import { authorizeUrl, identityFromIdToken } from '@/comments/google-oauth'

const CLIENT = 'client-id.apps.googleusercontent.com'

/** A JWT shaped like Google's, with whatever claims the case is about. Never signed. */
function idToken(claims: Record<string, unknown>): string {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature-not-checked`
}

const VALID = {
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: Math.floor(Date.now() / 1000) + 300,
  email: 'reader@example.com',
  email_verified: true,
  name: 'A Reader',
}

describe('identityFromIdToken', () => {
  it('accepts a well-formed token and returns the name and address', () => {
    expect(identityFromIdToken(idToken(VALID), CLIENT))
      .toEqual({ name: 'A Reader', email: 'reader@example.com' })
  })

  // The one that matters most: without it, an id_token minted for ANY other site's client
  // can be replayed here and adopted as an identity.
  it('refuses a token issued for a different client', () => {
    expect(() => identityFromIdToken(idToken({ ...VALID, aud: 'someone-elses-client' }), CLIENT))
      .toThrow(/another client/)
  })

  it('refuses a foreign issuer', () => {
    expect(() => identityFromIdToken(idToken({ ...VALID, iss: 'https://evil.example' }), CLIENT))
      .toThrow(/foreign issuer/)
  })

  it('refuses an expired token, and one with no expiry at all', () => {
    expect(() => identityFromIdToken(idToken({ ...VALID, exp: Math.floor(Date.now() / 1000) - 1 }), CLIENT))
      .toThrow(/expired/)
    expect(() => identityFromIdToken(idToken({ ...VALID, exp: undefined }), CLIENT)).toThrow(/expired/)
  })

  // Google will hand over an unverified address for some account types. A comment posted
  // under one is a comment posted under an address its owner never proved they hold.
  it('refuses an address Google has not verified', () => {
    expect(() => identityFromIdToken(idToken({ ...VALID, email_verified: false }), CLIENT))
      .toThrow(/verified email/)
    expect(() => identityFromIdToken(idToken({ ...VALID, email: undefined }), CLIENT))
      .toThrow(/verified email/)
  })

  it('refuses junk rather than treating it as an anonymous identity', () => {
    expect(() => identityFromIdToken('not.a.jwt', CLIENT)).toThrow()
    expect(() => identityFromIdToken('', CLIENT)).toThrow()
  })

  it('falls back to the local part when Google sends no name, and caps the length', () => {
    expect(identityFromIdToken(idToken({ ...VALID, name: undefined }), CLIENT).name).toBe('reader')
    expect(identityFromIdToken(idToken({ ...VALID, name: 'x'.repeat(200) }), CLIENT).name)
      .toHaveLength(80)
  })
})

describe('authorizeUrl', () => {
  it('asks for identity and nothing else', () => {
    const url = new URL(authorizeUrl(CLIENT, 'https://example.com/cb', 'state-1'))
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('state')).toBe('state-1')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/cb')
    // A shared browser profile is common, and silently reusing whichever account is signed
    // in publishes a comment under the wrong name.
    expect(url.searchParams.get('prompt')).toBe('select_account')
  })
})
