// Cloudflare Turnstile server-side verification. The SECRET key never leaves the
// server; the SITE key is public (rendered in the widget) and surfaced via
// comment-env.ts. Turnstile is only ENFORCED when both the owner toggle is on AND
// the secret is configured (see the comments POST route).

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// True when the secret is set — i.e. verification can actually run.
export function turnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY
}

// Verify a widget token with Cloudflare. Returns false on any failure (fail closed).
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret || !token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)
    const res = await fetch(SITEVERIFY, { method: 'POST', body })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (error) {
    console.error(`[ERROR] verifyTurnstile: ${(error as Error).message}`)
    return false
  }
}
