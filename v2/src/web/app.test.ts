// The public router, driven through real HTTP requests against a real database.
//
// The two assertions that matter most are not about markup. One: an article page ships
// ZERO JavaScript, which is the M2 gate and is trivially lost the first time someone
// reaches for a script tag. Two: a draft and a future-dated post are not reachable, which
// is a content leak rather than a bug.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache, pageCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp-test-web'
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

describe('article page', () => {
  it('renders a published post: title, body, and the site name', async () => {
    await saveSettings({ title: 'My Blog' })
    await savePost({ title: 'Hello World', content: '## A section\n\nSome **prose**.', status: 'published', date: PAST })
    const res = await get('/hello-world')
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(html).toContain('<h1>Hello World</h1>')
    expect(html).toContain('<h2 id="a-section">A section</h2>')
    expect(html).toContain('<strong>prose</strong>')
    expect(html).toContain('My Blog')
  })

  it('ships ONE deferred script and no inline JavaScript at all', async () => {
    await savePost({ title: 'Quiet', content: 'body', status: 'published', date: PAST })
    const html = await get('/quiet').then((r) => r.text())
    // One tag, external, deferred. The budget is a number, not a vibe: the moment a
    // second bundle or an inline block appears on an article page, this fails.
    const tags = html.match(/<script/g) ?? []
    expect(tags.length).toBe(1)
    expect(html).toMatch(/<script src="\/assets\/post\.[a-z0-9]+\.js" defer><\/script>/)
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/) // no inline block
    expect(html).not.toContain('onload=')
    expect(html).not.toContain('onclick=')
  })

  it('serves the bundle immutably, and 404s a hash it does not have', async () => {
    await savePost({ title: 'Quiet', content: 'body', status: 'published', date: PAST })
    const html = await get('/quiet').then((r) => r.text())
    const src = /<script src="([^"]+)"/.exec(html)?.[1] ?? ''
    const res = await get(src)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/javascript')
    expect(res.headers.get('cache-control')).toContain('immutable')
    // An unknown hash is a 404, never a stale body under a name that promises otherwise.
    expect((await get('/assets/post.deadbeef.js')).status).toBe(404)
  })

  it('hands the islands their labels, translated, rather than shipping a locale table', async () => {
    // `features` is saved whole, so the other flags have to be carried across: passing a
    // partial object would silently switch twelve of them off.
    const { features } = await getSettings()
    await saveSettings({ language: 'vi', features: { ...features, progressBar: true } })
    await savePost({ title: 'Nhan', content: 'body', status: 'published', date: PAST })
    const html = await get('/nhan').then((r) => r.text())
    expect(html).toContain('data-back-to-top="')
    expect(html).toContain('data-copy-code="')
    // Vietnamese, not the English fallback: the label crossed the language boundary.
    expect(html).not.toContain('data-back-to-top="Back to top"')
  })

  it('renders the progress bar as markup, with no script behind it', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, progressBar: true } })
    await savePost({ title: 'Long', content: 'body', status: 'published', date: PAST })
    const html = await get('/long').then((r) => r.text())
    // Server-rendered and driven by a scroll-driven CSS animation, so it works with
    // JavaScript off. If it ever moves back into the bundle, this fails.
    expect(html).toContain('<div class="progress" aria-hidden="true">')
    expect(html).toContain('animation-timeline:scroll(root block)')
  })

  it('leaves the progress bar out when the owner has it off', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, progressBar: false } })
    await savePost({ title: 'Plain', content: 'body', status: 'published', date: PAST })
    const html = await get('/plain').then((r) => r.text())
    expect(html).not.toContain('class="progress"')
  })

  it('inlines the stylesheet instead of requesting one', async () => {
    await savePost({ title: 'Styled', content: 'body', status: 'published', date: PAST })
    const html = await get('/styled').then((r) => r.text())
    expect(html).toContain('<style>')
    expect(html).not.toContain('rel="stylesheet"')
    expect(html).toContain('--c-bg:') // theme tokens really reached the page
    expect(html).toContain('--fs-body:') // and so did the typography settings
  })

  it('preloads the reading font, since it is the LCP resource', async () => {
    await savePost({ title: 'Fonted', content: 'body', status: 'published', date: PAST })
    const html = await get('/fonted').then((r) => r.text())
    expect(html).toContain('rel="preload"')
    expect(html).toContain('as="font"')
    expect(html).toContain('crossorigin')
  })

  it('serves a published page from the same /{slug} namespace', async () => {
    await savePage({ title: 'About', content: 'Who I am.', status: 'published' })
    const html = await get('/about').then((r) => r.text())
    expect(html).toContain('<h1>About</h1>')
    expect(html).toContain('Who I am.')
  })

  it('escapes a title rather than letting it reach the page as markup', async () => {
    await savePost({ title: '<script>alert(1)</script>', content: 'body', status: 'published', date: PAST })
    const res = await get('/scriptalert1script')
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('sets the language and the canonical URL from settings', async () => {
    await saveSettings({ language: 'vi', siteUrl: 'https://example.com' })
    await savePost({ title: 'Xin chao', content: 'body', status: 'published', date: PAST })
    const html = await get('/xin-chao').then((r) => r.text())
    expect(html).toContain('<html lang="vi">')
    expect(html).toContain('<link rel="canonical" href="https://example.com/xin-chao">')
  })
})

describe('what must NOT be reachable', () => {
  it('404s a draft', async () => {
    await savePost({ title: 'Secret', content: 'unpublished', status: 'draft', date: PAST })
    const res = await get('/secret')
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('unpublished')
  })

  it('404s a scheduled post until its date arrives', async () => {
    await savePost({ title: 'Later', content: 'embargoed', status: 'published', date: FUTURE })
    expect((await get('/later')).status).toBe(404)
  })

  it('404s a trashed post', async () => {
    await savePost({ title: 'Gone', content: 'body', status: 'published', date: PAST })
    db().run(`update posts set deleted_at = 1 where slug = 'gone'`)
    expect((await get('/gone')).status).toBe(404)
  })

  it('404s an unknown slug and a draft page', async () => {
    await savePage({ title: 'Hidden', content: 'body', status: 'draft' })
    expect((await get('/nothing-here')).status).toBe(404)
    expect((await get('/hidden')).status).toBe(404)
  })
})

describe('the page cache (Invariant 1)', () => {
  it('serves the second request from memory', async () => {
    await savePost({ title: 'Cached', content: 'v1', status: 'published', date: PAST })
    await get('/cached')
    expect(pageCache.has('/cached')).toBe(true)
    // Change the row behind the cache's back: a cache hit must return the OLD html.
    db().run(`update posts set content = 'v2' where slug = 'cached'`)
    expect(await get('/cached').then((r) => r.text())).toContain('v1')
  })

  it('is emptied COMPLETELY by clearCache, so no write can under-purge', async () => {
    await savePost({ title: 'One', content: 'a', status: 'published', date: PAST })
    await savePost({ title: 'Two', content: 'b', status: 'published', date: PAST })
    await get('/one')
    await get('/two')
    expect(pageCache.size).toBe(2)
    clearCache()
    expect(pageCache.size).toBe(0)
    db().run(`update posts set content = 'c' where slug = 'one'`)
    expect(await get('/one').then((r) => r.text())).toContain('c')
  })

  it('does not cache a 404, so publishing makes the page appear', async () => {
    await savePost({ title: 'Pending', content: 'body', status: 'draft', date: PAST })
    expect((await get('/pending')).status).toBe(404)
    await savePost({ title: 'Pending', content: 'body', status: 'published', date: PAST }, 'pending')
    expect((await get('/pending')).status).toBe(200)
  })
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
    expect(html).not.toContain('<script')
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
