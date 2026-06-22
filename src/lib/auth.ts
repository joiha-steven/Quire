// NextAuth v5 config: Google OAuth sign-in, single authorized owner.
// Google is the only provider; it loads when its credentials are present.
// Anyone can sign in, but only AUTHORIZED_EMAIL is treated as authorized.
// Unauthorized accounts are not blocked at sign-in (no error page); access is
// gated downstream so they are silently redirected to the homepage.

import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Google from 'next-auth/providers/google'

// Normalize for comparison: email is case-insensitive in practice and providers
// may return a different case / stray whitespace than what's configured.
const normalizeEmail = (e?: string | null): string => (e ?? '').trim().toLowerCase()
const AUTHORIZED_EMAIL = normalizeEmail(process.env.AUTHORIZED_EMAIL)

// Google loads only when its credentials are configured.
const providers: Provider[] = []
if (process.env.AUTH_GOOGLE_ID) providers.push(Google)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  callbacks: {
    // Persist the OAuth email onto the JWT so the session can expose it.
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email
      return token
    },
    async session({ session, token }) {
      if (session.user && typeof token.email === 'string') {
        session.user.email = token.email
      }
      return session
    },
  },
})

// True only for the configured owner. Safe to call with a null session.
export function isAuthorized(email?: string | null): boolean {
  return AUTHORIZED_EMAIL !== '' && normalizeEmail(email) === AUTHORIZED_EMAIL
}

// Resolve the current session and whether it belongs to the owner.
export async function getAuthState(): Promise<{ email: string | null; authorized: boolean }> {
  const session = await auth()
  const email = session?.user?.email ?? null
  return { email, authorized: isAuthorized(email) }
}
