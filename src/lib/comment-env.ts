// Server-only: which comment integrations are wired in the environment. A toggle
// in settings is only EFFECTIVE when its keys exist here; the admin UI flags a
// toggle that lacks them. The Turnstile SITE key is public (it renders in the
// widget) so it is safe to send to the client; no secret is ever exposed.

export type CommentEnv = {
  turnstileConfigured: boolean // TURNSTILE_SECRET_KEY present (verification can run)
  googleConfigured: boolean // AUTH_GOOGLE_ID present (provider loaded)
  facebookConfigured: boolean // AUTH_FACEBOOK_ID present (provider loaded)
  turnstileSiteKey: string // public site key for the widget ('' = none)
}

export function getCommentEnv(): CommentEnv {
  return {
    turnstileConfigured: !!process.env.TURNSTILE_SECRET_KEY,
    googleConfigured: !!process.env.AUTH_GOOGLE_ID,
    facebookConfigured: !!process.env.AUTH_FACEBOOK_ID,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY ?? '',
  }
}
