import { describe, it, expect } from 'vitest'
import { newlyLive } from '@/lib/scheduled'

// Fixed clock so the (since, now] window is deterministic.
const NOW = Date.parse('2026-07-23T10:00:00Z')
const SINCE = NOW - 6 * 60 * 1000 // 6-min lookback

const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('newlyLive', () => {
  it('includes a published post whose date fell inside (since, now]', () => {
    const posts = [{ slug: 'a', status: 'published', date: at(-2 * 60 * 1000) }]
    expect(newlyLive(posts, SINCE, NOW)).toEqual(['a'])
  })

  it('excludes a post still in the future (date > now)', () => {
    const posts = [{ slug: 'future', status: 'published', date: at(60 * 1000) }]
    expect(newlyLive(posts, SINCE, NOW)).toEqual([])
  })

  it('excludes a post that crossed before the window (date <= since)', () => {
    const posts = [{ slug: 'old', status: 'published', date: at(-10 * 60 * 1000) }]
    expect(newlyLive(posts, SINCE, NOW)).toEqual([])
  })

  it('is inclusive at now and exclusive at since', () => {
    const posts = [
      { slug: 'at-now', status: 'published', date: new Date(NOW).toISOString() },
      { slug: 'at-since', status: 'published', date: new Date(SINCE).toISOString() },
    ]
    expect(newlyLive(posts, SINCE, NOW)).toEqual(['at-now'])
  })

  it('ignores drafts even when their date is inside the window', () => {
    const posts = [{ slug: 'draft', status: 'draft', date: at(-2 * 60 * 1000) }]
    expect(newlyLive(posts, SINCE, NOW)).toEqual([])
  })

  it('ignores a malformed date', () => {
    const posts = [{ slug: 'bad', status: 'published', date: 'not-a-date' }]
    expect(newlyLive(posts, SINCE, NOW)).toEqual([])
  })
})
