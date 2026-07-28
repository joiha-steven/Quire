// The transforms and the checksum. These are the functions where an import corrupts data
// quietly: a timestamp read as seconds, a boolean written as the string "false", a
// duplicate tag aborting a transaction over something cosmetic.
import { describe, it, expect } from 'bun:test'
import {
  ts, bool, boolOrNull, text, json, textArray, termRows, expectedTermCount, uriList,
  ImportTransformError,
} from '@/import/transform'
import { rowDigest, tableChecksum, CHECKSUM_COLUMNS, CHECKSUM_KEYS } from '@/import/checksum'

describe('ts', () => {
  it('converts every timestamptz rendering Postgres emits to the same instant', () => {
    const want = Date.parse('2026-07-27T10:00:00.000Z')
    for (const form of [
      '2026-07-27T10:00:00+00:00', '2026-07-27T10:00:00Z', '2026-07-27T10:00:00.000Z',
      '2026-07-27T17:00:00+07:00',
    ]) {
      expect(ts(form)).toBe(want)
    }
  })

  it('preserves NULL and treats an empty string as absent', () => {
    expect(ts(null)).toBeNull()
    expect(ts(undefined)).toBeNull()
    expect(ts('')).toBeNull()
  })

  it('passes a number through, so a re-run over already-converted rows is safe', () => {
    expect(ts(1_785_000_000_000)).toBe(1_785_000_000_000)
  })

  it('THROWS on an unparseable value rather than importing a post dated 1970', () => {
    expect(() => ts('yesterday')).toThrow(ImportTransformError)
  })
})

describe('bool', () => {
  it('accepts every form a boolean column can arrive in', () => {
    expect([true, 't', 'true', '1', 1].map(bool)).toEqual([1, 1, 1, 1, 1])
    expect([false, 'f', 'false', '0', 0, '', null].map(bool)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('throws on anything else instead of guessing', () => {
    expect(() => bool('maybe')).toThrow(ImportTransformError)
  })

  it('keeps NULL distinct where NULL means "not chosen"', () => {
    expect(boolOrNull(null)).toBeNull()
    expect(boolOrNull(false)).toBe(0)
  })
})

describe('text and json', () => {
  it('distinguishes NULL from an empty string', () => {
    expect(text(null)).toBeNull()
    expect(text('')).toBe('')
  })

  it('passes JSON through verbatim, without reshaping', () => {
    const data = { title: 'A', nested: { list: [1, 2], flag: false } }
    expect(JSON.parse(json(data))).toEqual(data)
  })

  it('turns a missing settings blob into an empty object, not "null"', () => {
    expect(json(null)).toBe('{}')
  })
})

describe('termRows', () => {
  it('produces one row per term, tagged by kind', () => {
    expect(termRows('a', ['Dev'], ['bun', 'sqlite'])).toEqual([
      { post_slug: 'a', kind: 'category', term: 'Dev' },
      { post_slug: 'a', kind: 'tag', term: 'bun' },
      { post_slug: 'a', kind: 'tag', term: 'sqlite' },
    ])
  })

  it('de-dupes within a kind, because the junction primary key would abort the import', () => {
    expect(termRows('a', [], ['bun', 'bun', ' bun '])).toHaveLength(1)
  })

  it('keeps the same name as BOTH a category and a tag', () => {
    expect(termRows('a', ['bun'], ['bun'])).toHaveLength(2)
  })

  it('drops blanks and non-strings, which were never reachable as a URL', () => {
    expect(termRows('a', ['', '   ', null, 7], [])).toEqual([])
  })

  it('handles a NULL array column', () => {
    expect(termRows('a', null, undefined)).toEqual([])
  })

  it('counts the SAME way the writer writes, so a duplicate tag is not a fatal miscount', () => {
    const posts = [
      { slug: 'a', categories: ['Dev'], tags: ['bun', 'bun'] },
      { slug: 'b', categories: null, tags: ['x'] },
    ]
    expect(expectedTermCount(posts)).toBe(3)
    expect(posts.flatMap((p) => termRows(p.slug, p.categories, p.tags))).toHaveLength(3)
  })
})

describe('uriList', () => {
  it('renders a text[] as a JSON array a reader can parse back', () => {
    expect(JSON.parse(uriList(['https://a/cb', 'https://b/cb']))).toEqual(['https://a/cb', 'https://b/cb'])
    expect(uriList(null)).toBe('[]')
  })
})

describe('textArray', () => {
  it('drops nulls inside a Postgres array', () => {
    expect(textArray(['a', null, 'b'])).toEqual(['a', 'b'])
  })
})

describe('checksum', () => {
  const COLS = CHECKSUM_COLUMNS.posts
  const post = (over: Record<string, unknown> = {}) => ({
    slug: 'a', title: 'A', content: 'body', status: 'published',
    date: '2026-07-27T10:00:00+00:00', excerpt: null, featured_image: null,
    cover_image: null, series: null, series_order: 0, meta_title: null,
    meta_description: null, reading_minutes: 3,
    created_at: '2026-07-01T00:00:00+00:00', updated_at: '2026-07-02T00:00:00+00:00',
    deleted_at: null, broadcast_at: null, ...over,
  })

  it('agrees across the two sides representations of the SAME row', () => {
    // What PostgREST sends, versus what SQLite holds after the import.
    const source = post()
    const target = post({
      date: Date.parse('2026-07-27T10:00:00Z'),
      created_at: Date.parse('2026-07-01T00:00:00Z'),
      updated_at: Date.parse('2026-07-02T00:00:00Z'),
    })
    expect(rowDigest(source, COLS)).toBe(rowDigest(target, COLS))
  })

  it('treats an absent key and a NULL column as the same thing', () => {
    const { excerpt: _drop, ...without } = post()
    void _drop
    expect(rowDigest(without, COLS)).toBe(rowDigest(post(), COLS))
  })

  it('CATCHES a shifted date, which is the whole point', () => {
    const shifted = post({ date: '2026-07-27T11:00:00+00:00' })
    expect(rowDigest(shifted, COLS)).not.toBe(rowDigest(post(), COLS))
  })

  it('catches a lost character in the body', () => {
    expect(rowDigest(post({ content: 'bod' }), COLS)).not.toBe(rowDigest(post(), COLS))
  })

  it('cannot be fooled by moving a character between adjacent columns', () => {
    const a = post({ title: 'ab', content: 'c' })
    const b = post({ title: 'a', content: 'bc' })
    expect(rowDigest(a, COLS)).not.toBe(rowDigest(b, COLS))
  })

  it('is independent of row order, since the two sides sort differently', () => {
    const rows = [post({ slug: 'b' }), post({ slug: 'a' }), post({ slug: 'c' })]
    const key = CHECKSUM_KEYS.posts
    expect(tableChecksum(rows, key, COLS)).toBe(tableChecksum([...rows].reverse(), key, COLS))
  })

  it('reports the row count alongside the hash, so a mismatch says how far off it is', () => {
    expect(tableChecksum([post()], 'slug', COLS)).toStartWith('1:')
    expect(tableChecksum([], 'slug', COLS)).toStartWith('0:')
  })

  it('catches a missing row', () => {
    const rows = [post({ slug: 'a' }), post({ slug: 'b' })]
    expect(tableChecksum(rows, 'slug', COLS)).not.toBe(tableChecksum(rows.slice(1), 'slug', COLS))
  })
})
