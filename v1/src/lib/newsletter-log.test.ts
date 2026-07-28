import { describe, it, expect, vi } from 'vitest'

// The send log is what the admin's "emails sent / open rate" columns are made of, so
// the fold has to be right: a FAILED send is not a send, and the open-rate denominator
// is successful BROADCASTS only (a confirm mail carries no pixel and can never be
// "opened", so counting it would permanently drag the rate down).
type Row = Record<string, unknown>
const state = vi.hoisted(() => ({ rows: [] as Row[] }))

vi.mock('@/lib/db', () => {
  type Query = {
    select: () => Query
    eq: (col: string, val: unknown) => Query
    order: () => Query
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) => unknown
  }
  const builder = (): Query => {
    const filters: ((r: Row) => boolean)[] = []
    const q: Query = {
      select: () => q,
      order: () => q,
      eq: (col, val) => {
        filters.push((r) => r[col] === val)
        return q
      },
      then: (resolve) => resolve({ data: state.rows.filter((r) => filters.every((f) => f(r))), error: null }),
    }
    return q
  }
  return { db: () => ({ from: () => builder() }), DB_TAG: 'db' }
})

const { statsByEmail, statsByPost } = await import('@/lib/newsletter-log')

const row = (o: Partial<Row>): Row => ({
  email: 'a@x.test',
  kind: 'broadcast',
  post_slug: 'p1',
  ok: true,
  sent_at: '2026-07-01T00:00:00Z',
  error: null,
  opened_at: null,
  ...o,
})

describe('statsByEmail', () => {
  it('counts successes and failures apart, and rates opens against broadcasts only', async () => {
    state.rows = [
      row({ kind: 'confirm', post_slug: null, sent_at: '2026-07-01T00:00:00Z' }),
      row({ sent_at: '2026-07-02T00:00:00Z', opened_at: '2026-07-02T01:00:00Z' }),
      row({ sent_at: '2026-07-03T00:00:00Z' }),
      row({ ok: false, error: 'mailbox full', sent_at: '2026-07-04T00:00:00Z' }),
    ]
    const a = (await statsByEmail()).get('a@x.test')
    expect(a?.sent).toBe(3) // the failure is NOT a send
    expect(a?.failed).toBe(1)
    expect(a?.lastError).toBe('mailbox full')
    expect(a?.broadcasts).toBe(2) // confirm + failed broadcast excluded
    expect(a?.opened).toBe(1)
    expect(a?.lastAt).toBe('2026-07-04T00:00:00Z') // newest wins
  })

  it('keeps addresses apart', async () => {
    state.rows = [row({ email: 'a@x.test' }), row({ email: 'b@x.test' }), row({ email: 'b@x.test' })]
    const map = await statsByEmail()
    expect(map.get('a@x.test')?.sent).toBe(1)
    expect(map.get('b@x.test')?.sent).toBe(2)
  })
})

describe('statsByPost', () => {
  it('rolls up per slug and ignores rows with no post', async () => {
    state.rows = [
      row({ post_slug: 'p1', opened_at: '2026-07-02T01:00:00Z' }),
      row({ post_slug: 'p1' }),
      row({ post_slug: 'p2', ok: false, error: 'refused' }),
      row({ post_slug: null }),
    ]
    const map = await statsByPost()
    expect(map.get('p1')?.sent).toBe(2)
    expect(map.get('p1')?.opened).toBe(1)
    expect(map.get('p2')?.sent).toBe(0)
    expect(map.get('p2')?.failed).toBe(1)
    expect(map.size).toBe(2)
  })
})
