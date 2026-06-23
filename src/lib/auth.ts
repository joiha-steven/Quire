// NextAuth v5 config: Google OAuth sign-in, single authorized owner.
// Google is the only provider; it loads when its credentials are present.
// Anyone can sign in, but only AUTHORIZED_EMAIL is treated as authorized.
// Unauthorized accounts are not blocked at sign-in (no error page); access is
// gated downstream so they are silently redirected to the homepage.

import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import type { CommentProvider } from '@/types'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'

// Normalize for comparison: email is case-insensitive in practice and providers
// may return a different case / stray whitespace than what's configured.
const normalizeEmail = (e?: string | null): string => (e ?? '').trim().toLowerCase()
const AUTHORIZED_EMAIL = normalizeEmail(process.env.AUTHORIZED_EMAIL)

// Each provider loads only when its credentials are configured. Google is the
// owner's admin sign-in AND a commenter option; Facebook is commenter-only.
const providers: Provider[] = []
if (process.env.AUTH_GOOGLE_ID) providers.push(Google)
if (process.env.AUTH_FACEBOOK_ID) providers.push(Facebook)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  callbacks: {
    // Persist email + name + which provider onto the JWT so the session can
    // expose a commenter's identity (the comment POST trusts it for OAuth users).
    async jwt({ token, account, profile }) {
      if (account?.provider) token.provider = account.provider
      if (profile?.email) token.email = profile.email
      if (profile?.name) token.name = profile.name
      return token
    },
    async session({ session, token }) {
      if (session.user && typeof token.email === 'string') session.user.email = token.email
      if (session.user && typeof token.name === 'string') session.user.name = token.name
      if (typeof token.provider === 'string') session.provider = token.provider
      return session
    },
  },
})

// True only for the configured owner. Safe to call with a null session.
export function isAuthorized(email?: string | null): boolean {
  return AUTHORIZED_EMAIL !== '' && normalizeEmail(email) === AUTHORIZED_EMAIL
}

// Resolve the signed-in commenter's identity (anyone, not just the owner), or
// null when logged out. The comment POST trusts this for OAuth comments.
export async function getCommenter(): Promise<{ name: string; email: string; provider: CommentProvider } | null> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return null
  const p = session.provider
  const provider: CommentProvider = p === 'google' || p === 'facebook' ? p : 'manual'
  return { name: session.user?.name || email, email, provider }
}

// Resolve the current session and whether it belongs to the owner.
export async function getAuthState(): Promise<{ email: string | null; authorized: boolean }> {
  const session = await auth()
  const email = session?.user?.email ?? null
  return { email, authorized: isAuthorized(email) }
}
