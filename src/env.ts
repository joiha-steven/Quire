// Boot-time env validation. Runs ONCE at server startup via instrumentation.ts, so a
// misconfigured self-host fails fast with a readable list instead of surfacing later
// as an empty page or a 401. NOT run at build time — the data layer intentionally
// degrades to empty with no backend env (see CLAUDE.md § Env / Caching).

import { z } from 'zod'

const schema = z.object({
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required (generate with: npx auth secret)'),
  AUTHORIZED_EMAIL: z.string().min(1, 'AUTHORIZED_EMAIL is required (the owner sign-in email)'),
  POSTGREST_URL: z
    .string()
    .min(1, 'POSTGREST_URL is required (your PostgREST endpoint)')
    .refine((v) => URL.canParse(v), 'POSTGREST_URL must be a valid URL'),
  POSTGREST_TOKEN: z
    .string()
    .min(1, 'POSTGREST_TOKEN is required (the service_role JWT)'),
})

// Present-but-optional: warn (don't fail) so the app still boots for a first look.
const recommended: [string, string][] = [
  ['SITE_URL', 'canonical/OG/sitemap URLs fall back to the request host'],
  ['CRON_SECRET', '/api/cron (keep-alive + variant sweep + backup) is unauthenticated without it'],
  ['STORAGE_LOCAL_DIR', "binaries default to ./uploads, which most deploys don't persist"],
  ['ANALYTICS_TZ', 'analytics day/week buckets are truncated in UTC (set an IANA zone, e.g. Asia/Ho_Chi_Minh)'],
]

// The dev sign-in (see lib/auth.ts) is a real auth bypass, so it gets a second gate
// here: a production server REFUSES TO START while DEV_LOGIN is set. The provider is
// already unreachable in a production build; this makes the misconfiguration loud
// instead of leaving the operator to assume it is doing something.
function assertNoDevLoginInProduction(): void {
  if (process.env.NODE_ENV === 'production' && process.env.DEV_LOGIN) {
    throw new Error(
      'DEV_LOGIN is set on a PRODUCTION server. It exists only for local development ' +
        '(it signs you in as AUTHORIZED_EMAIL without Google). Unset it and restart.',
    )
  }
}

export function validateEnv(): void {
  assertNoDevLoginInProduction()
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.message}`).join('\n')
    throw new Error(`Invalid environment — fix these before starting Quire:\n${lines}`)
  }
  for (const [key, why] of recommended) {
    if (!process.env[key]) console.warn(`[env] ${key} is not set — ${why}`)
  }
}
