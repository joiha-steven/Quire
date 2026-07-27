// The pages that are not one article: listings, search, the feeds, the shared chrome and
// the table of contents.
//
// Split from `app.test.ts` to stay under the 400-line rule. Same harness, its OWN database
// directory: `openDatabases` holds one connection pair per process, so two test files
// sharing a directory would close each other's.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache, pageCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp-test-pages'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
// `app.request` is typed `Response | Promise<Response>`; awaiting it once here keeps
// every call site a plain promise.
const get = async (path: string): Promise<Response> => app.request(path)

const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

describe('listings', () => {
  const publish = (title: string, over: Record<string, unknown> = {}) =>
    savePost({ title, content: 'body text here', status: 'published', date: PAST, ...over })

  it('lists posts newest first on the home page, with links and excerpts', async () => {
    await saveSettings({ title: 'My Blog', description: 'A tagline' })
    await publish('Older', { date: '2020-01-01T00:00:00.000Z' })
    await publish('Newer', { date: '2021-01-01T00:00:00.000Z' })
    const html = await get('/').then((r) => r.text())
    expect(html.indexOf('Newer')).toBeLessThan(html.indexOf('Older'))
    expect(html).toContain('href="/newer"')
    expect(html).toContain('A tagline')
  })

  it('paginates, and 404s a page past the end', async () => {
    await saveSettings({ postsPerPage: 2 })
    for (const n of [1, 2, 3]) await publish(`Post ${n}`)
    const first = await get('/').then((r) => r.text())
    expect(first).toContain('rel="next"')
    expect(first).not.toContain('rel="prev"')
    expect((await get('/page/2')).status).toBe(200)
    expect((await get('/page/3')).status).toBe(404)
    expect((await get('/page/zero')).status).toBe(404)
  })

  it('serves a category and a tag page, and 404s an unknown term', async () => {
    await publish('Tagged', { categories: ['Ghi chép'], tags: ['bun'] })
    const cat = await get('/category/ghi-chep').then((r) => r.text())
    expect(cat).toContain('Ghi chép')
    expect(cat).toContain('href="/tagged"')
    expect((await get('/tag/bun')).status).toBe(200)
    expect((await get('/category/nothing')).status).toBe(404)
  })

  it('serves a series in reading order, oldest part first', async () => {
    await publish('Part Two', { series: 'Notes', seriesOrder: 1 })
    await publish('Part One', { series: 'Notes', seriesOrder: 0 })
    const html = await get('/series/notes').then((r) => r.text())
    expect(html.indexOf('Part One')).toBeLessThan(html.indexOf('Part Two'))
    expect((await get('/series/nope')).status).toBe(404)
  })

  it('links a post back to its series and its tags', async () => {
    await publish('Part One', { series: 'Notes', seriesOrder: 0, tags: ['bun'] })
    await publish('Part Two', { series: 'Notes', seriesOrder: 1 })
    const html = await get('/part-one').then((r) => r.text())
    expect(html).toContain('href="/part-two"')
    expect(html).toContain('href="/tag/bun"')
  })
})

describe('search', () => {
  it('finds a post by a word in its body, accent-insensitively', async () => {
    await savePost({ title: 'Lập trình hằng ngày', content: 'viết blog mười năm', status: 'published', date: PAST })
    const html = await get('/search?q=lap%20trinh').then((r) => r.text())
    expect(html).toContain('href="/lap-trinh-hang-ngay"')
  })

  it('does not throw on FTS operator characters', async () => {
    await savePost({ title: 'Punctuated', content: 'about C++', status: 'published', date: PAST })
    for (const q of ['C%2B%2B', '%22', 'OR', 'NEAR(']) {
      expect((await get(`/search?q=${q}`)).status).toBe(200)
    }
  })

  it('shows a prompt with no query and stays out of the page cache', async () => {
    expect((await get('/search')).status).toBe(200)
    expect(pageCache.has('/search')).toBe(false)
  })
})

describe('machine-readable surfaces', () => {
  it('serves RSS, sitemap, robots and llms.txt', async () => {
    await saveSettings({ title: 'My Blog', siteUrl: 'https://example.com' })
    await savePost({ title: 'Hello', content: 'body', status: 'published', date: PAST, excerpt: 'A summary' })
    await savePage({ title: 'About', content: 'body', status: 'published' })

    const feed = await get('/feed.xml')
    expect(feed.headers.get('content-type')).toContain('application/rss+xml')
    const xml = await feed.text()
    expect(xml).toContain('<link>https://example.com/hello</link>')
    expect(xml).toContain('A summary')

    const sitemap = await get('/sitemap.xml').then((r) => r.text())
    expect(sitemap).toContain('http://www.sitemaps.org/schemas/sitemap/0.9')
    expect(sitemap).toContain('<loc>https://example.com/about</loc>')

    const robots = await get('/robots.txt').then((r) => r.text())
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml')

    expect(await get('/llms.txt').then((r) => r.text())).toContain('(https://example.com/hello)')
  })

  it('excludes drafts and future posts from every feed', async () => {
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({ title: 'Draft', content: 'body', status: 'draft', date: PAST })
    await savePost({ title: 'Later', content: 'body', status: 'published', date: FUTURE })
    for (const path of ['/feed.xml', '/sitemap.xml', '/llms.txt']) {
      const body = await get(path).then((r) => r.text())
      expect(body).not.toContain('/draft')
      expect(body).not.toContain('/later')
    }
  })

  it('404s a feed the owner turned off, rather than serving an empty one', async () => {
    await saveSettings({ seo: { autoSchema: true, sitemap: false, llms: true, robots: true, rss: false, ogImage: true, ogFallbackImage: '' } })
    expect((await get('/feed.xml')).status).toBe(404)
    expect((await get('/sitemap.xml')).status).toBe(404)
    expect((await get('/llms.txt')).status).toBe(200)
  })

  it('escapes XML rather than letting a title break the document', async () => {
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({ title: 'Tom & Jerry <fight>', content: 'body', status: 'published', date: PAST })
    const xml = await get('/feed.xml').then((r) => r.text())
    expect(xml).toContain('Tom &amp; Jerry &lt;fight&gt;')
    expect(xml).not.toContain('<fight>')
  })
})

describe('the site chrome', () => {
  it('gives every page the same header, and both triggers work without JavaScript', async () => {
    await saveSettings({ title: 'My Blog', description: 'A tagline' })
    await savePost({ title: 'Chromed', content: 'body', status: 'published', date: PAST })

    for (const path of ['/', '/chromed']) {
      const html = await get(path).then((r) => r.text())
      // A LINK, not a button: without JavaScript it goes to the search page, which renders
      // the same results server-side. The island turns it into an overlay.
      expect(html).toContain('href="/search"')
      expect(html).toContain('data-search-open')
      expect(html).toContain('<footer class="site">')
    }
  })

  it('hides the search trigger when the owner turns search off', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, search: false } })
    await savePost({ title: 'Quiet', content: 'body', status: 'published', date: PAST })
    expect(await get('/quiet').then((r) => r.text())).not.toContain('data-search-open')
  })

  it('leaves the subscribe trigger out when there is no mail server', async () => {
    // A trigger with nothing behind it is worse than no trigger.
    await savePost({ title: 'Mailless', content: 'body', status: 'published', date: PAST })
    const html = await get('/mailless').then((r) => r.text())
    expect(html).not.toContain('data-subscribe-open')
    expect(html).not.toContain('form class="subscribe"')
  })

  it('renders the owner footer through the markdown sanitiser, not raw', async () => {
    await saveSettings({ title: 'My Blog', footer: '**Bold** and <script>alert(1)</script>' })
    await savePost({ title: 'Footed', content: 'body', status: 'published', date: PAST })
    const html = await get('/footed').then((r) => r.text())
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})

describe('the table of contents', () => {
  const LONG = '## First section\n\nText.\n\n### A sub-heading\n\nText.\n\n## Second section\n\nText.'

  it('is server-rendered, so it works with no JavaScript at all', async () => {
    await savePost({ title: 'Long', content: LONG, status: 'published', date: PAST })
    const html = await get('/long').then((r) => r.text())
    // The list is real markup and its links are real anchors. The bundle only adds the
    // active-section highlight, which is the part that genuinely needs a script.
    expect(html).toContain('<nav class="toc rail"')
    expect(html).toContain('href="#first-section"')
    expect(html).toContain('href="#a-sub-heading"')
    expect(html).toContain('class="toc-l3"') // nesting survives
    expect(html).toContain('id="first-section"') // and the anchors it points at exist
  })

  it('leaves it out of a post with one heading, which is furniture not navigation', async () => {
    await savePost({ title: 'Short', content: '## Only one\n\nText.', status: 'published', date: PAST })
    expect(await get('/short').then((r) => r.text())).not.toContain('<nav class="toc rail"')
  })

  it('leaves it out when the owner turns it off', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, toc: false } })
    await savePost({ title: 'Notoc', content: LONG, status: 'published', date: PAST })
    expect(await get('/notoc').then((r) => r.text())).not.toContain('<nav class="toc rail"')
  })

  it('is a rail, with the breakpoint computed from the reading column', async () => {
    // A media query cannot read a CSS variable, so the width at which the contents list
    // moves into the left gutter is COMPUTED from the owner's column width: 250 + 40 + 10
    // of rail on each side. Change the column and the breakpoint follows, which is the
    // whole reason this CSS is generated rather than written by hand.
    await saveSettings({ contentWidth: 700 })
    await savePost({ title: 'Railed', content: LONG, status: 'published', date: PAST })
    expect(await get('/railed').then((r) => r.text())).toContain('@media (min-width:1300px)')

    clearCache()
    await saveSettings({ contentWidth: 800 })
    expect(await get('/railed').then((r) => r.text())).toContain('@media (min-width:1400px)')
  })

  it('leaves it off a static page, which has no post structure', async () => {
    await savePage({ title: 'About', content: LONG, status: 'published' })
    expect(await get('/about').then((r) => r.text())).not.toContain('<nav class="toc rail"')
  })
})
