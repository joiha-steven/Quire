// The document shell every public page is rendered into, and the one page that had none.
//
// Separate from `app.test.ts` because the subject is different: that file drives the router
// and asserts what a URL RESOLVES to, this one asserts what wraps the answer. It exists as
// its own file because a miss used to escape the shell entirely — `text/plain` carries no
// viewport meta, so a phone laid the two words out at the default 980px desktop width and
// let the reader pan the page sideways. Measured at 390px: the document was 980px wide.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache, pageCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp-test-shell'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)

const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(async () => {
  db().run('delete from posts')
  clearCache()
  await savePost({
    title: 'A Published Post', slug: 'published', content: 'Body.',
    status: 'published', date: PAST, categories: ['Essays'],
  })
})

describe('a URL that is not here', () => {
  it('is a page in the site shell, with the viewport meta a phone needs', async () => {
    const res = await get('/khong-co-trang-nay')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('name="viewport"')
    expect(html).toContain('width=device-width')
    // Dressed as an empty listing rather than as a new kind of page, and it offers the
    // way back, which the two words did not.
    expect(html).toContain('listing-head')
    expect(html).toContain('href="/"')
  })

  it('is refused by a shared cache, because a cached miss outlives its reason', async () => {
    const res = await get('/khong-co-trang-nay')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  // `paginate` CLAMPS an out-of-range page, so these two took a different path to the same
  // bare-text answer and have to be checked separately.
  it('answers a malformed page number the same way', async () => {
    for (const path of ['/page/abc', '/category/essays/page/abc']) {
      const res = await get(path)
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toContain('text/html')
    }
  })

  it('is never written to the page cache', async () => {
    await get('/khong-co-trang-nay')
    expect(pageCache.get('/khong-co-trang-nay')).toBeUndefined()
  })
})

describe('the head of every public page', () => {
  it('points at the feed, so an aggregator can find it', async () => {
    const html = await (await get('/')).text()
    expect(html).toContain('rel="alternate"')
    expect(html).toContain('type="application/rss+xml"')
    expect(html).toContain('href="/feed.xml"')
  })

  it('does not advertise the feed when the owner has it switched off', async () => {
    const on = await getSettings()
    await saveSettings({ seo: { ...on.seo, rss: false } })
    clearCache()
    const html = await (await get('/')).text()
    expect(html).not.toContain('application/rss+xml')
    await saveSettings({ seo: { ...on.seo, rss: true } })
    clearCache()
  })
})

describe('the first tab stop on every public page', () => {
  // Without it a keyboard reader tabs through four header controls, the whole contents rail
  // and the info panel before reaching the article.
  it('is a skip link that lands on the main element', async () => {
    const html = await (await get('/')).text()
    const skip = html.indexOf('class="skip-link" href="#content"')
    expect(skip).toBeGreaterThan(-1)
    // FIRST, ahead of the header's own controls: a skip link after them skips nothing.
    expect(skip).toBeLessThan(html.indexOf('class="site-bar"'))
    expect(html).toContain('<main id="content"')
  })

  it('is on an article too, not only a listing', async () => {
    const html = await (await get('/published')).text()
    expect(html).toContain('class="skip-link" href="#content"')
    expect(html).toContain('<main id="content"')
  })
})
