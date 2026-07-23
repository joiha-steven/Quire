import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimited, clientIp } from '@/lib/rate-limit'

describe('rateLimited', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('blocks only after exceeding max within the window', () => {
    const k = `t-${Math.random()}`
    expect(rateLimited(k, 2, 1000)).toBe(false) // 1
    expect(rateLimited(k, 2, 1000)).toBe(false) // 2
    expect(rateLimited(k, 2, 1000)).toBe(true) // 3 > max
  })

  it('forgets old hits once the window passes (and evicts the key)', () => {
    const k = `t-${Math.random()}`
    rateLimited(k, 1, 1000)
    expect(rateLimited(k, 1, 1000)).toBe(true)
    vi.advanceTimersByTime(1500) // window elapsed
    // A hit on a DIFFERENT key triggers the sweep that drops the now-stale key…
    rateLimited(`other-${Math.random()}`, 1, 1000)
    // …and the original key starts fresh (not still-blocked).
    expect(rateLimited(k, 1, 1000)).toBe(false)
  })
})

describe('clientIp', () => {
  const req = (h: Record<string, string>) => new Request('https://x/', { headers: h })

  it('prefers CF-Connecting-IP (not client-forwardable) over X-Forwarded-For', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('9.9.9.9')
  })

  it('falls back to the first X-Forwarded-For hop, then unknown', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
    expect(clientIp(req({}))).toBe('unknown')
  })
})
