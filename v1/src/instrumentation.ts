// Next.js instrumentation — runs once when the server boots. We use it only to
// fail-fast on a misconfigured environment (see env.ts). Guarded so it NEVER runs
// during `next build` (the data layer degrades to empty with no backend env) or on
// the edge runtime (middleware/OG don't need the full set).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { validateEnv } = await import('./env')
  validateEnv()
}
