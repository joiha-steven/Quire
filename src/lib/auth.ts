// NextAuth v5 config: OAuth sign-in, single authorized owner.
// Providers (Google, GitHub) are enabled per env — only the ones whose
// credentials are present load, so a self-hoster can pick either or both.
// Anyone can sign in, but only AUTHORIZED_EMAIL is treated as authorized.
// Unauthorized accounts are not blocked at sign-in (no error page); access is
// gated downstream so they are silently redirected to the homepage.

import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

// Normalize for comparison: email is case-insensitive in practice and providers
// may return a different case / stray whitespace than what's configured.
const normalizeEmail = (e?: string | null): string => (e ?? '').trim().toLowerCase()
const AUTHORIZED_EMAIL = normalizeEmail(process.env.AUTHORIZED_EMAIL)

// Load only the providers that have credentials configured.
const providers: Provider[] = []
if (process.env.AUTH_GOOGLE_ID) providers.push(Google)
if (process.env.AUTH_GITHUB_ID) providers.push(GitHub)

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
