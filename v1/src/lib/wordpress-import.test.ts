import { describe, it, expect } from 'vitest'
import { parseWxr } from './wordpress-import'

const NOW = '2026-01-01T00:00:00.000Z'

// Minimal WXR: one published post (with category + tag + a captioned figure), one
// draft page, and one attachment that must be skipped.
const WXR = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/">
<channel>
  <item>
    <title>Hello &amp; Welcome</title>
    <content:encoded><![CDATA[<h2>Intro</h2><figure><img src="https://old.example/cat.jpg"/><figcaption>A cat</figcaption></figure><p>Body text here.</p>]]></content:encoded>
    <excerpt:encoded><![CDATA[]]></excerpt:encoded>
    <wp:post_name>hello-welcome</wp:post_name>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_date_gmt>2025-05-04 09:00:00</wp:post_date_gmt>
    <category domain="category" nicename="news">News</category>
    <category domain="category" nicename="uncategorized">Uncategorized</category>
    <category domain="post_tag" nicename="cats">cats</category>
  </item>
  <item>
    <title>About</title>
    <content:encoded><![CDATA[<p>About page.</p>]]></content:encoded>
    <wp:post_name>about</wp:post_name>
    <wp:post_type>page</wp:post_type>
    <wp:status>draft</wp:status>
  </item>
  <item>
    <title>logo.png</title>
    <wp:post_type>attachment</wp:post_type>
    <wp:status>inherit</wp:status>
  </item>
</channel>
</rss>`

describe('parseWxr', () => {
  const r = parseWxr(WXR, NOW)

  it('imports posts and pages, skips attachments', () => {
    expect(r.posts).toHaveLength(1)
    expect(r.pages).toHaveLength(1)
    expect(r.skipped).toBe(1)
  })

  it('maps status, decodes the title, keeps the slug', () => {
    const p = r.posts[0]
    expect(p.title).toBe('Hello & Welcome')
    expect(p.slug).toBe('hello-welcome')
    expect(p.status).toBe('published')
    expect(p.date).toBe('2025-05-04T09:00:00.000Z')
  })

  it('splits categories/tags and drops Uncategorized', () => {
    const p = r.posts[0]
    expect(p.categories).toEqual(['News'])
    expect(p.tags).toEqual(['cats'])
  })

  it('converts HTML to Markdown and folds the figure caption into the image alt', () => {
    const p = r.posts[0]
    expect(p.content).toContain('## Intro')
    expect(p.content).toContain('![A cat](https://old.example/cat.jpg)')
  })

  it('derives an excerpt when the export has none', () => {
    expect(r.posts[0].excerpt).toContain('Body text here.')
  })

  it('maps a draft page correctly', () => {
    const pg = r.pages[0]
    expect(pg.title).toBe('About')
    expect(pg.slug).toBe('about')
    expect(pg.status).toBe('draft')
    expect(pg.content).toContain('About page.')
  })
})
