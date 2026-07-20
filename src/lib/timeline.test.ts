import { describe, it, expect } from 'vitest'
import { buildTimeline, monthKey } from './timeline'
import type { Post } from '@/types'

// Minimal published-post factory: the timeline only reads `date`.
const post = (date: string, slug = date): Post => ({
  title: slug,
  slug,
  date,
  status: 'published',
  categories: [],
  tags: [],
})

describe('monthKey', () => {
  it('takes YYYY-MM from an ISO date', () => {
    expect(monthKey('2026-06-18T20:16:00+00:00')).toBe('2026-06')
  })
})

describe('buildTimeline', () => {
  it('groups a newest-first list into years → months with counts and first indexes', () => {
    const posts = [
      post('2026-06-18T00:00:00Z', 'a'), // 2026-06 #0
      post('2026-06-02T00:00:00Z', 'b'), // 2026-06 #1
      post('2026-05-28T00:00:00Z', 'c'), // 2026-05 #2
      post('2025-12-10T00:00:00Z', 'd'), // 2025-12 #3
    ]
    const years = buildTimeline(posts, 'en')

    expect(years.map((y) => y.year)).toEqual(['2026', '2025'])

    const [y2026, y2025] = years
    expect(y2026.months.map((m) => m.key)).toEqual(['2026-06', '2026-05'])
    expect(y2026.months[0]).toMatchObject({ key: '2026-06', count: 2 })
    expect(y2026.months[1]).toMatchObject({ key: '2026-05', count: 1 })
    expect(y2025.months[0]).toMatchObject({ key: '2025-12', count: 1 })
  })

  it('localizes the month label (English long name, Vietnamese "Tháng N")', () => {
    const [year] = buildTimeline([post('2026-06-18T00:00:00Z')], 'en')
    expect(year.months[0].label).toBe('June')
    const [viYear] = buildTimeline([post('2026-06-18T00:00:00Z')], 'vi')
    expect(viYear.months[0].label).toBe('Tháng 6')
  })

  it('splits a non-contiguous (unsorted) month into repeats — caller must pass newest-first', () => {
    const years = buildTimeline([post('2026-06-18T00:00:00Z', 'a'), post('2026-05-01T00:00:00Z', 'b'), post('2026-06-01T00:00:00Z', 'c')], 'en')
    // One year bucket, but June appears twice because May interrupted it.
    expect(years).toHaveLength(1)
    expect(years[0].months.map((m) => m.key)).toEqual(['2026-06', '2026-05', '2026-06'])
  })

  it('returns an empty array for no posts', () => {
    expect(buildTimeline([], 'en')).toEqual([])
  })
})
