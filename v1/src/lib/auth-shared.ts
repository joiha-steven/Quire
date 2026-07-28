// Pure auth helpers with NO NextAuth / DB imports — safe for the edge middleware
// (which must not pull in the Supabase client or the async provider config).

// Normalize for comparison: email is case-insensitive in practice and providers
// may return a different case / stray whitespace than what's configured.
export const normalizeEmail = (e?: string | null): string => (e ?? '').trim().toLowerCase()

const AUTHORIZED_EMAIL = normalizeEmail(process.env.AUTHORIZED_EMAIL)

// True only for the configured owner. Safe to call with a null/undefined email.
export function isAuthorized(email?: string | null): boolean {
  return AUTHORIZED_EMAIL !== '' && normalizeEmail(email) === AUTHORIZED_EMAIL
}
