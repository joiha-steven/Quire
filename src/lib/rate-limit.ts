// Best-effort in-memory sliding-window rate limiter, keyed by client IP. Per-instance
// (resets on restart, not shared across replicas) — a coarse flood-blunter, NOT a hard
// quota. Limits are deliberately generous so a real reader/owner never hits them; the
// point is only to blunt a script hammering a public endpoint.

const buckets = new Map<string, number[]>()

// Returns true when this hit exceeds `max` within `windowMs` (i.e. should be blocked).
export function rateLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  buckets.set(key, recent)
  return recent.length > max
}

// First hop of X-Forwarded-For (set by the trusted proxy/CDN in front), else 'unknown'.
export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
}
