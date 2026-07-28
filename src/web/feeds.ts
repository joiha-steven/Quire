// The machine-readable surfaces: RSS, sitemap, robots and llms.txt.
//
// All four are plain strings built from the same public post list, and all four are
// gated by a setting the owner controls (`settings.seo`). A disabled feed 404s rather
// than serving an empty document: an empty feed looks like a broken site to a reader's
// aggregator, while a 404 looks like what it is.

import type { Page, Post, SiteSettings } from '@/types'
import { toPlainText, clampExcerpt } from '@/utils'

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const rfc822 = (iso: string) => new Date(iso).toUTCString()
const isoDay = (iso: string) => new Date(iso).toISOString().slice(0, 10)

/** RSS 2.0. Bodies are deliberately NOT included: a description is the excerpt. */
export function renderFeed(posts: Post[], settings: SiteSettings, site: string): string {
  const items = posts.slice(0, 50).map((p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(`${site}/${p.slug}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${site}/${p.slug}`)}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${escapeXml(p.excerpt ?? '')}</description>
    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(settings.title)}</title>
    <link>${escapeXml(site)}</link>
    <description>${escapeXml(settings.description)}</description>
    <language>${escapeXml(settings.language)}</language>
    <atom:link href="${escapeXml(`${site}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`
}

export function renderSitemap(posts: Post[], pages: Page[], site: string): string {
  const url = (loc: string, lastmod?: string) =>
    `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${isoDay(lastmod)}</lastmod>` : ''}</url>`
  const entries = [
    url(site),
    ...posts.map((p) => url(`${site}/${p.slug}`, p.updatedAt ?? p.date)),
    ...pages.map((p) => url(`${site}/${p.slug}`)),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
}

export function renderRobots(settings: SiteSettings, site: string): string {
  // The admin is owner-gated anyway; keeping it out of the crawl budget is the point.
  const sitemap = settings.seo.sitemap ? `\nSitemap: ${site}/sitemap.xml` : ''
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api${sitemap}
`
}

/**
 * `llms.txt`: the site as an index a model can read, newest first. Titles and one-line
 * summaries, not bodies — a model that wants the body follows the link.
 */
export function renderLlms(posts: Post[], pages: Page[], settings: SiteSettings, site: string): string {
  const line = (title: string, slug: string, summary: string) =>
    `- [${title}](${site}/${slug})${summary ? `: ${summary}` : ''}`
  const postLines = posts.map((p) =>
    line(p.title, p.slug, clampExcerpt(p.excerpt ?? toPlainText(''))))
  const pageLines = pages.map((p) => line(p.title, p.slug, ''))
  return `# ${settings.title}

${settings.description}

## Posts

${postLines.join('\n')}

## Pages

${pageLines.join('\n')}
`
}
