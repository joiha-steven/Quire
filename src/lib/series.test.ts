import { describe, it, expect } from 'vitest'
import { orderSeries } from '@/lib/series'
import type { Post } from '@/types'

const post = (slug: string, seriesOrder: number, date: string): Post => ({
  title: slug,
  slug,
  date,
  status: 'published',
  categories: [],
  tags: [],
  series: 'S',
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
