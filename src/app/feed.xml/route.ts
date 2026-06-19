// /feed.xml — RSS 2.0 of the latest published posts. 404 when toggled off.
import { getPublicPosts } from '@/lib/posts'
import { getSettings, resolveSiteUrl } from '@/lib/settings'

const MAX_ITEMS = 50

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(): Promise<Response> {
  const s = await getSettings()
  if (!s.seo.rss) return new Response('Not found', { status: 404 })

  const base = resolveSiteUrl(s)
  const posts = (await getPublicPosts()).slice(0, MAX_ITEMS)

  const items = posts
    .map((p) => {
      const url = `${base}/${p.slug}`
      return [
        '    <item>',
        `      <title>${esc(p.title)}</title>`,
        `      <link>${esc(url)}</link>`,
        `      <guid isPermaLink="true">${esc(url)}</guid>`,
        `      <pubDate>${new Date(p.date).toUTCString()}</pubDate>`,
        p.excerpt ? `      <description>${esc(p.excerpt)}</description>` : '',
        ...p.categories.map((c) => `      <category>${esc(c)}</category>`),
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(s.title)}</title>
    <link>${esc(base)}</link>
    <description>${esc(s.description || s.title)}</description>
    <language>${s.language}</language>
    <atom:link href="${esc(`${base}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
