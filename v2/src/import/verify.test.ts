// The four verification tiers, plus an end-to-end run of the writers against a real
// database. The importer's whole value is being able to say "this is complete" and be
// believed, so what is tested here is that each tier actually FAILS on the corruption it
// claims to catch, not just that it passes on good data.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one, all } from '@/store/query'
import {
  verifyCounts, verifyChecksums, verifySpot, verifySemantic, verifySearch, isFatal,
  formatFindings,
} from '@/import/verify'
import { WRITERS, advanceSequences, rebuildSearchIndex, SEQUENCE_TABLES } from '@/import/write'

const DIR = './.tmp-test-import'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  for (const t of ['posts', 'post_terms', 'pages', 'comments', 'media', 'files',
    'subscribers', 'redirects', 'post_revisions', 'settings', 'mcp_clients']) {
    db().run(`delete from ${t}`)
  }
  db().run(`delete from sqlite_sequence`)
})

// A v1 row exactly as PostgREST hands it over: ISO strings, real booleans, text[] arrays.
const v1Post = (over: Record<string, unknown> = {}) => ({
  slug: 'hello', title: 'Hello World', content: 'body', status: 'published',
  date: '2026-07-27T10:00:00+00:00', excerpt: 'x', featured_image: null, cover_image: null,
  series: null, series_order: 0, meta_title: null, meta_description: null,
  reading_minutes: 1, categories: ['Dev'], tags: ['bun'],
  created_at: '2026-07-01T00:00:00+00:00', updated_at: '2026-07-02T00:00:00+00:00',
  deleted_at: null, broadcast_at: null, ...over,
})

describe('writers', () => {
  it('converts a v1 post into SQLite storage, terms included', () => {
    WRITERS.posts!(db(), v1Post())
    const row = one<{ date: number; status: string; created_at: number }>(
      `select date, status, created_at from posts where slug = 'hello'`)!
    expect(row.date).toBe(Date.parse('2026-07-27T10:00:00Z'))
    expect(row.created_at).toBe(Date.parse('2026-07-01T00:00:00Z'))
    expect(all(`select 1 from post_terms`)).toHaveLength(2)
  })

  it('preserves ids exactly, including gaps, because parent_id depends on it', () => {
    WRITERS.posts!(db(), v1Post())
    for (const id of [1, 7, 99]) {
      WRITERS.comments!(db(), {
        id, post_slug: 'hello', parent_id: null, depth: 0, author_name: 'A',
        author_email: 'a@b.co', author_website: null, author_ip: null, author_country: null,
        provider: 'manual', content: 'hi', created_at: '2026-07-01T00:00:00+00:00', deleted_at: null,
      })
    }
    expect(all<{ id: number }>(`select id from comments order by id`).map((r) => r.id)).toEqual([1, 7, 99])
  })

  it('advances AUTOINCREMENT past the imported ids, so the next insert cannot collide', () => {
    WRITERS.posts!(db(), v1Post())
    WRITERS.comments!(db(), {
      id: 500, post_slug: 'hello', parent_id: null, depth: 0, author_name: 'A',
      author_email: 'a@b.co', author_website: null, author_ip: null, author_country: null,
      provider: 'manual', content: 'hi', created_at: '2026-07-01T00:00:00+00:00', deleted_at: null,
    })
    advanceSequences(db(), SEQUENCE_TABLES)
    const next = one<{ id: number }>(
      `insert into comments (post_slug, content, created_at) values ('hello', 'x', 1) returning id`)!
    expect(next.id).toBeGreaterThan(500)
  })

  it('drops the Drive refresh token but keeps the run history', () => {
    WRITERS.backup_state!(db(), {
      id: 1, refresh_token: 'SECRET-TOKEN', folder_id: 'f1',
      last_run_at: '2026-07-01T00:00:00+00:00', last_status: 'ok', last_error: null, last_size: 42,
    })
    const row = one<{ refresh_token: string | null; last_status: string; last_run_at: number }>(
      `select refresh_token, last_status, last_run_at from backup_state`)!
    expect(row.refresh_token).toBeNull()
    expect(row.last_status).toBe('ok')
    expect(row.last_run_at).toBe(Date.parse('2026-07-01T00:00:00Z'))
  })

  it('rebuilds the search index from the imported rows', () => {
    WRITERS.posts!(db(), v1Post({ title: 'Lập trình hằng ngày' }))
    rebuildSearchIndex(db())
    const hits = db().query<{ slug: string }, [string]>(
      `select p.slug from posts_fts f join posts p on p.rowid = f.rowid where posts_fts match ?`)
      .all(`"lap trinh"`)
    expect(hits.map((h) => h.slug)).toEqual(['hello'])
  })

  it('stores redirect_uris as a JSON array the reader can parse', () => {
    WRITERS.mcp_clients!(db(), {
      client_id: 'c1', redirect_uris: ['https://a/cb'], created_at: '2026-07-01T00:00:00+00:00',
    })
    expect(JSON.parse(one<{ redirect_uris: string }>(`select redirect_uris from mcp_clients`)!.redirect_uris))
      .toEqual(['https://a/cb'])
  })
})

describe('tier 1: counts', () => {
  it('passes when both sides agree', () => {
    expect(verifyCounts({ posts: 10 }, { posts: 10 })).toEqual([])
  })

  it('is FATAL on any difference, including a table missing entirely', () => {
    const f = verifyCounts({ posts: 10, pages: 3 }, { posts: 9 })
    expect(f).toHaveLength(2)
    expect(f.every((x) => x.fatal)).toBe(true)
    expect(f[0]!.detail).toContain('source 10 rows, imported 9')
  })
})

describe('tier 2: checksums', () => {
  const src = [v1Post()]
  const imported = (over: Record<string, unknown> = {}) => [{
    ...v1Post(),
    date: Date.parse('2026-07-27T10:00:00Z'),
    created_at: Date.parse('2026-07-01T00:00:00Z'),
    updated_at: Date.parse('2026-07-02T00:00:00Z'),
    ...over,
  }]

  it('passes across the two sides representations of the same data', () => {
    expect(verifyChecksums('posts', src, imported())).toEqual([])
  })

  it('is FATAL on a changed body, and points at tier 3 for the detail', () => {
    const f = verifyChecksums('posts', src, imported({ content: 'bod' }))
    expect(f).toHaveLength(1)
    expect(f[0]!.fatal).toBe(true)
    expect(f[0]!.detail).toContain('run tier 3')
  })

  it('is FATAL on a dropped row', () => {
    expect(verifyChecksums('posts', src, [])).toHaveLength(1)
  })
})

describe('tier 3: spot comparison', () => {
  const src = [v1Post(), v1Post({ slug: 'second', title: 'Second' })]
  const good = src.map((p) => ({ ...p, date: Date.parse(String(p.date)) }))

  it('passes on matching rows', () => {
    expect(verifySpot('posts', src, good, 42)).toEqual([])
  })

  it('names the row AND the column, which a checksum cannot', () => {
    const bad = good.map((p) => (p.slug === 'second' ? { ...p, title: 'Wrong' } : p))
    const f = verifySpot('posts', src, bad, 42)
    expect(f[0]!.detail).toContain('slug=second')
    expect(f[0]!.detail).toContain('column title')
    expect(f[0]!.detail).toContain('Second')
  })

  it('reports a row that did not arrive at all', () => {
    const f = verifySpot('posts', src, good.slice(1), 42)
    expect(f.some((x) => x.detail.includes('missing after import'))).toBe(true)
  })

  it('is reproducible from its seed', () => {
    const bad = good.map((p) => ({ ...p, title: 'Wrong' }))
    expect(verifySpot('posts', src, bad, 7)).toEqual(verifySpot('posts', src, bad, 7))
  })
})

describe('tier 4: semantics', () => {
  const base = {
    sourcePosts: [{ slug: 'a', categories: ['Dev'], tags: ['bun'] }],
    targetTerms: [
      { post_slug: 'a', kind: 'category', term: 'Dev' },
      { post_slug: 'a', kind: 'tag', term: 'bun' },
    ],
    postSlugs: ['a'],
    pageSlugs: ['about'],
    comments: [{ id: 1, parent_id: null }, { id: 2, parent_id: 1 }],
    sourceOrphanIds: [],
    softDeleted: [{ table: 'posts', source: 2, target: 2 }],
  }

  it('passes on a clean import', () => {
    expect(verifySemantic(base)).toEqual([])
  })

  it('catches a term that did not arrive, and one that appeared from nowhere', () => {
    expect(verifySemantic({ ...base, targetTerms: base.targetTerms.slice(1) })[0]!.detail)
      .toContain('missing term a|category|Dev')
    expect(verifySemantic({
      ...base, targetTerms: [...base.targetTerms, { post_slug: 'a', kind: 'tag', term: 'ghost' }],
    })[0]!.detail).toContain('unexpected term')
  })

  it('catches a slug that became BOTH a post and a page (Invariant 2)', () => {
    const f = verifySemantic({ ...base, pageSlugs: ['a'] })
    expect(f[0]!.detail).toContain('BOTH a post and a page')
  })

  it('catches a comment pointing at a parent that did not arrive', () => {
    const f = verifySemantic({ ...base, comments: [{ id: 2, parent_id: 99 }] })
    expect(f[0]!.detail).toContain('missing parent 99')
  })

  it('ACCEPTS a v1 orphan, which must survive as an orphan rather than be repaired', () => {
    expect(verifySemantic({
      ...base, comments: [{ id: 2, parent_id: 99 }], sourceOrphanIds: [2],
    })).toEqual([])
  })

  it('catches trashed rows silently dropped or restored (Invariant 6)', () => {
    const f = verifySemantic({ ...base, softDeleted: [{ table: 'posts', source: 2, target: 0 }] })
    expect(f[0]!.detail).toContain('source 2, imported 0')
  })
})

describe('tier 4: search', () => {
  it('passes when a title word finds its post', () => {
    expect(verifySearch([{ word: 'Hello', slug: 'a', hits: ['a'] }])).toEqual([])
  })

  it('fails, readably, when the index did not come back', () => {
    const f = verifySearch([{ word: 'Hello', slug: 'a', hits: [] }])
    expect(f[0]!.detail).toContain('did not return /a')
    expect(f[0]!.detail).toContain('nothing')
  })
})

describe('reporting', () => {
  it('says so plainly when everything passed', () => {
    expect(formatFindings([])).toContain('all four tiers passed')
    expect(isFatal([])).toBe(false)
  })

  it('marks a fatal finding as fatal in the output', () => {
    const f = verifyCounts({ posts: 1 }, { posts: 0 })
    expect(formatFindings(f)).toContain('FATAL tier 1 posts')
    expect(isFatal(f)).toBe(true)
  })
})
