// /llms.txt — a Markdown index of the site for AI crawlers (see llmstxt.org).
// Lists every published post (title, URL, excerpt) plus the static pages.
// Returns 404 when the feature is toggled off.
import { getPublicPosts } from '@/lib/posts'
import { getPublicPages } from '@/lib/pages'
import { getSettings, resolveSiteUrl } from '@/lib/settings'

export const dynamic = 'force-dynamic' // always reflect the latest posts

export async function GET(): Promise<Response> {
  const s = await getSettings()
  if (!s.seo.llms) return new Response('Not found', { status: 404 })

  const base = resolveSiteUrl(s)
  const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])

  const lines: string[] = [`# ${s.title}`]
  if (s.description) lines.push('', `> ${s.description}`)

  if (posts.length) {
    lines.push('', '## Posts')
    for (const p of posts) {
      const ex = p.excerpt ? `: ${p.excerpt}` : ''
      lines.push(`- [${p.title}](${base}/${p.slug})${ex}`)
    }
  }
  if (pages.length) {
    lines.push('', '## Pages')
    for (const p of pages) lines.push(`- [${p.title}](${base}/${p.slug})`)
  }

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
