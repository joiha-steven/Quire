// Boot-time env validation. Runs ONCE at server startup via instrumentation.ts, so a
// misconfigured self-host fails fast with a readable list instead of surfacing later
// as an empty page or a 401. NOT run at build time — the data layer intentionally
// degrades to empty with no backend env (see CLAUDE.md § Env / Caching).

import { z } from 'zod'

const schema = z.object({
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required (generate with: npx auth secret)'),
  AUTHORIZED_EMAIL: z.string().min(1, 'AUTHORIZED_EMAIL is required (the owner sign-in email)'),
  SUPABASE_URL: z
    .string()
    .min(1, 'SUPABASE_URL is required (your PostgREST endpoint)')
    .refine((v) => URL.canParse(v), 'SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required (the service_role JWT)'),
})

// Present-but-optional: warn (don't fail) so the app still boots for a first look.
const recommended: [string, string][] = [
  ['SITE_URL', 'canonical/OG/sitemap URLs fall back to the request host'],
  ['CRON_SECRET', '/api/cron (keep-alive + variant sweep + backup) is unauthenticated without it'],
  ['STORAGE_LOCAL_DIR', "binaries default to ./uploads, which most deploys don't persist"],
]

export function validateEnv(): void {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.message}`).join('\n')
    throw new Error(`Invalid environment — fix these before starting Quire:\n${lines}`)
  }
  for (const [key, why] of recommended) {
    if (!process.env[key]) console.warn(`[env] ${key} is not set — ${why}`)
  }
}
