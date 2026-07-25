// NextAuth v5 config: Google OAuth sign-in, single authorized owner.
// Google is the only provider; it loads when its credentials are present.
// Anyone can sign in, but only AUTHORIZED_EMAIL is treated as authorized.
// Unauthorized accounts are not blocked at sign-in (no error page); access is
// gated downstream so they are silently redirected to the homepage.

import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import type { CommentProvider } from '@/types'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { isAuthorized } from '@/lib/auth-shared'

// LOCAL DEVELOPMENT ONLY — sign in as the owner without Google, so the admin can be
// driven (and tested headlessly) on a machine that has no OAuth credentials. Two gates,
// both required:
//   1. NODE_ENV !== 'production'. `next build && next start` and the Docker image are
//      both production, so this provider CANNOT exist in a real deployment.
//   2. DEV_LOGIN holds a secret that must be typed in. Not a bare on/off flag, so even
//      a dev-mode server left exposed is not a one-click takeover.
// `src/env.ts` additionally refuses to boot a production server while DEV_LOGIN is set.
export function devLoginEnabled(nodeEnv = process.env.NODE_ENV, secret = process.env.DEV_LOGIN): boolean {
  return nodeEnv !== 'production' && !!secret
}

const devLoginProvider = () =>
  Credentials({
    id: 'dev-login',
    name: 'Developer sign-in (local only)',
    credentials: { secret: { label: 'DEV_LOGIN secret', type: 'password' } },
    authorize: (creds) => {
      const given = typeof creds?.secret === 'string' ? creds.secret : ''
      // Compare against the env secret; a wrong or empty value is simply not a sign-in.
      if (!given || given !== process.env.DEV_LOGIN) return null
      const email = process.env.AUTHORIZED_EMAIL ?? ''
      return email ? { id: email, email, name: email } : null
    },
  })

// Re-export so existing importers (`@/lib/auth`) keep working.
export { isAuthorized } from '@/lib/auth-shared'

// Config is a FUNCTION so the commenter providers can read runtime state: Google
// (it's also the owner's admin sign-in) loads when its env credentials exist.
// This runs in Node only — the edge middleware reads the JWT directly (see
// middleware.ts), so it never pulls the Supabase client into the edge bundle.
export const { handlers, auth, signOut } = NextAuth(async () => {
  const providers: Provider[] = []
  if (process.env.AUTH_GOOGLE_ID) providers.push(Google)
  if (devLoginEnabled()) {
    console.warn('[auth] DEV_LOGIN is on — the local developer sign-in is available. Never set this in production.')
    providers.push(devLoginProvider())
  }
  return {
    providers,
    callbacks: {
    // Persist email + name + which provider onto the JWT so the session can
    // expose a commenter's identity (the comment POST trusts it for OAuth users).
    async jwt({ token, account, profile, user }) {
      if (account?.provider) token.provider = account.provider
      if (profile?.email) token.email = profile.email
      if (profile?.name) token.name = profile.name
      // Credentials sign-in (the dev login) has no OAuth `profile` — the identity comes
      // back on `user` from authorize().
      if (!profile && user?.email) {
        token.email = user.email
        token.name = user.name ?? user.email
      }
      return token
    },
      async session({ session, token }) {
        if (session.user && typeof token.email === 'string') session.user.email = token.email
        if (session.user && typeof token.name === 'string') session.user.name = token.name
        if (typeof token.provider === 'string') session.provider = token.provider
        return session
      },
    },
  }
})

// Resolve the signed-in commenter's identity (anyone, not just the owner), or
// null when logged out. The comment POST trusts this for OAuth comments.
export async function getCommenter(): Promise<{ name: string; email: string; provider: CommentProvider } | null> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return null
  const p = session.provider
  const provider: CommentProvider = p === 'google' ? p : 'manual'
  return { name: session.user?.name || email, email, provider }
}

// Resolve the current session and whether it belongs to the owner.
export async function getAuthState(): Promise<{ email: string | null; authorized: boolean }> {
  const session = await auth()
  const email = session?.user?.email ?? null
  return { email, authorized: isAuthorized(email) }
}
