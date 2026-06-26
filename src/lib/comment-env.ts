// Server-only: which comment integrations are usable right now. Turnstile keys
// come from the admin-managed `integration_keys` table (env fallback); Google
// stays in env (it's also the owner's admin sign-in). A toggle
// in settings is only EFFECTIVE when its keys exist — the admin UI flags the rest.
// The Turnstile SITE key is public (it renders in the widget), so it's safe to
// send to the client; no secret is ever exposed.

import { getIntegrationStatus } from '@/lib/integration-keys'

export type CommentEnv = {
  turnstileConfigured: boolean // a Turnstile secret exists (verification can run)
  googleConfigured: boolean // AUTH_GOOGLE_ID present (provider loaded)
  turnstileSiteKey: string // public site key for the widget ('' = none)
}

export async function getCommentEnv(): Promise<CommentEnv> {
  const s = await getIntegrationStatus()
  return {
    turnstileConfigured: s.turnstileConfigured,
    googleConfigured: !!process.env.AUTH_GOOGLE_ID,
    turnstileSiteKey: s.turnstileSiteKey,
  }
}
