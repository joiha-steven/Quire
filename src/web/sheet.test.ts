// The public stylesheet: one hashed, immutable request, and the settings layer inline.
//
// Split out of `app.test.ts` at the 400-line limit. The seam holds because these two
// assertions are about a CACHING contract rather than about any page: one URL for the
// whole site, and a body that may be held for a year because its name changes when it does.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp-test-sheet'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const PAST = '2020-01-01T00:00:00.000Z'

const sheetHref = (html: string): string =>
  /<link rel="stylesheet" href="([^"]+)">/.exec(html)?.[1] ?? ''

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

describe('the public stylesheet', () => {
  it('links the static sheet and inlines only what the settings decide', async () => {
    await savePost({ title: 'Styled', content: 'body', status: 'published', date: PAST })
    await savePost({ title: 'Styled Two', content: 'body', status: 'published', date: PAST })
    const html = await get('/styled').then((r) => r.text())
    // The static half: one request, hashed, and therefore cacheable for a year. The whole
    // sheet used to be inlined into every page, which re-sent 13.8 KB gzipped on every
    // navigation for information that had not changed.
    expect(html).toMatch(/<link rel="stylesheet" href="\/assets\/site\.[a-z0-9]+\.css">/)
    // The settings half stays inline, AFTER the link, because it is allowed to win.
    expect(html.indexOf('rel="stylesheet"')).toBeLessThan(html.indexOf('<style>'))
    expect(html).toContain('--c-bg:') // theme tokens really reached the page
    expect(html).toContain('--fs-body:') // and so did the typography settings

    // One URL for the whole site: two pages must not each mint their own, or the caching
    // this exists for never happens.
    const other = await get('/styled-two').then((r) => r.text())
    expect(sheetHref(other)).toBe(sheetHref(html))
  })

  it('serves the sheet as immutable CSS', async () => {
    await savePost({ title: 'Styled', content: 'body', status: 'published', date: PAST })
    const href = sheetHref(await get('/styled').then((r) => r.text()))
    const res = await get(href)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/css')
    // `immutable` is only honest because the URL carries the content hash: change the
    // sheet and the path changes with it, so no reader is ever held on a stale one.
    expect(res.headers.get('cache-control')).toContain('immutable')
    expect(await res.text()).toContain('.prose')
  })
})
