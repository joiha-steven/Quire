import { describe, it, expect } from 'vitest'
import { orderSeries, seriesEntries } from '@/lib/series-order'
import type { Post } from '@/types'

const post = (slug: string, seriesOrder: number, date: string, series = 'S'): Post => ({
  title: slug,
  slug,
  date,
  status: 'published',
  categories: [],
  tags: [],
  series,
  seriesOrder,
})

describe('orderSeries', () => {
  it('sorts by seriesOrder ascending', () => {
    const out = orderSeries([post('c', 3, '2020-01-01'), post('a', 1, '2020-01-01'), post('b', 2, '2020-01-01')])
    expect(out.map((p) => p.slug)).toEqual(['a', 'b', 'c'])
  })

  it('breaks ties by date (oldest first, chronological reading order)', () => {
    const out = orderSeries([post('new', 0, '2021-06-01'), post('old', 0, '2020-01-01')])
    expect(out.map((p) => p.slug)).toEqual(['old', 'new'])
  })

  it('does not mutate the input array', () => {
    const input = [post('b', 2, '2020-01-01'), post('a', 1, '2020-01-01')]
    orderSeries(input)
    expect(input.map((p) => p.slug)).toEqual(['b', 'a'])
  })

  it('treats a missing seriesOrder as 0', () => {
    const a: Post = { ...post('a', 0, '2020-01-01'), seriesOrder: undefined }
    const b = post('b', 1, '2019-01-01')
    // a (order 0) precedes b (order 1) despite b being older
    expect(orderSeries([b, a]).map((p) => p.slug)).toEqual(['a', 'b'])
  })
})

describe('seriesEntries', () => {
  const noSeries: Post = { ...post('x', 0, '2020-01-01'), series: undefined, seriesOrder: undefined }

  it('groups posts by series, parts ordered like the public box', () => {
    const out = seriesEntries([
      post('a2', 2, '2020-01-01', 'A'),
      post('a1', 1, '2020-01-01', 'A'),
      post('b1', 1, '2020-01-01', 'B'),
      noSeries,
    ])
    const a = out.find((s) => s.name === 'A')!
    expect(a.parts.map((p) => p.slug)).toEqual(['a1', 'a2'])
    expect(out.map((s) => s.name)).not.toContain(undefined)
  })

  it('sorts series busiest first, ties alphabetical', () => {
    const out = seriesEntries([
      post('z1', 1, '2020-01-01', 'Z'),
      post('a1', 1, '2020-01-01', 'A'),
      post('a2', 2, '2020-01-01', 'A'),
    ])
    // A has 2 parts (first), Z has 1
    expect(out.map((s) => s.name)).toEqual(['A', 'Z'])
  })

  it('carries a URL slug per series', () => {
    const out = seriesEntries([post('a1', 1, '2020-01-01', 'My Series')])
    expect(out[0].slug).toBe('my-series')
  })
})
