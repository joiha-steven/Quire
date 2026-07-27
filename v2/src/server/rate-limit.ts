// Best-effort in-memory sliding-window rate limiter, keyed by client IP. Per-instance
// (resets on restart, not shared across replicas) — a coarse flood-blunter, NOT a hard
// quota. Limits are deliberately generous so a real reader/owner never hits them; the
// point is only to blunt a script hammering a public endpoint. For a multi-replica
// hosted deploy this must move to a shared store (Redis); documented, not hidden.

const buckets = new Map<string, number[]>()
let lastSweep = 0

// Drop keys whose every timestamp has aged out, so the Map can't grow unbounded on a
// long-running server (one key per distinct IP, forever, was a slow memory leak).
function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < windowMs) return
  lastSweep = now
  for (const [key, times] of buckets) {
    if (times.length === 0 || now - times[times.length - 1] >= windowMs) buckets.delete(key)
  }
}

// Returns true when this hit exceeds `max` within `windowMs` (i.e. should be blocked).
export function rateLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now()
  sweep(now, windowMs)
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  buckets.set(key, recent)
  return recent.length > max
}

// `rateLimited` above both records the hit and reports the verdict, which is right for a
// public endpoint where every request is equally a request. Sign-in is different: a
// LOCKOUT must count failures only. Charging a successful sign-in against the same window
// means the owner signing in for the sixth time in fifteen minutes is locked out of their
// own blog, having done nothing wrong — so the two halves are separable below.

/** The verdict alone. Records nothing, so a caller can ask before deciding to charge. */
export function overLimit(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  // `>=`, not `>`: this is asked BEFORE the attempt, so `max` recorded failures means the
  // allowance is already spent and this attempt is the one to refuse.
  return recent.length >= max
}

/** Charge one hit against a key. Called after an attempt is known to have failed. */
export function recordHit(key: string, windowMs = 60_000): void {
  const now = Date.now()
  sweep(now, windowMs)
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  buckets.set(key, recent)
}

/** Forget a key. A successful sign-in clears the failures that preceded it. */
export function clearLimit(key: string): void {
  buckets.delete(key)
}

/**
 * Test seam. The buckets are process-global, so a test that deliberately exhausts a window
 * decides the outcome of every test after it in the same file — which it did, the first
 * time the sign-in lockout was tested.
 */
export function resetLimits(): void {
  buckets.clear()
  lastSweep = 0
}

// Best-effort client IP. Prefer `CF-Connecting-IP` (set by Cloudflare, the documented
// front-end, and NOT forwardable by the client) so a spoofed `X-Forwarded-For` can't
// evade the limiter or poison the analytics hash; fall back to the first XFF hop, then
// 'unknown'. If you front the app with a different proxy, make it set CF-Connecting-IP
// or strictly overwrite XFF.
export function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
}
