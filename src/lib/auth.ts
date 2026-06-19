// NextAuth v5 config: GitHub OAuth, single authorized owner.
// Anyone can sign in, but only AUTHORIZED_EMAIL is treated as authorized.
// Unauthorized accounts are not blocked at sign-in (no error page); access is
// gated downstream so they are silently redirected to the homepage.

import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL ?? ''

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    // Persist the GitHub email onto the JWT so the session can expose it.
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
  return Boolean(email) && email === AUTHORIZED_EMAIL && AUTHORIZED_EMAIL !== ''
}

// Resolve the current session and whether it belongs to the owner.
export async function getAuthState(): Promise<{ email: string | null; authorized: boolean }> {
  const session = await auth()
  const email = session?.user?.email ?? null
  return { email, authorized: isAuthorized(email) }
}
