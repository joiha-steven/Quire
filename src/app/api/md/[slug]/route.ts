// Markdown for Agents. `next.config.ts` rewrites a `/:slug` request carrying
// `Accept: text/markdown` here, so an agent gets the post/page as its authored
// Markdown (the stored source) instead of parsing rendered HTML. Read-only and
// public — allow-listed in `middleware.ts` (`isPublicApi`). Same visibility rules
// as the HTML page: published pages, and posts that are public + not future-dated.
import { getPost } from '@/lib/posts'
import { getPage } from '@/lib/pages'
import { formatDate } from '@/lib/i18n'
import { getSettings } from '@/lib/settings'
import { isPublicallyVisible } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function markdown(title: string, meta: string, body: string): Response {
  const doc = `# ${title}\n\n${meta ? `${meta}\n\n` : ''}${body}\n`
  return new Response(doc, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex', // the canonical is the HTML page; don't index the raw view
    },
  })
}

export async function GET(_req: Request, ctx: RouteContext<'/api/md/[slug]'>): Promise<Response> {
  const { slug } = await ctx.params
  const [post, page, settings] = await Promise.all([getPost(slug), getPage(slug), getSettings()])

  if (post && isPublicallyVisible(post.status, post.date)) {
    const parts = [formatDate(post.date, settings.language)]
    if (post.categories.length) parts.push(post.categories.join(', '))
    return markdown(post.title, `*${parts.join(' · ')}*`, post.content)
  }
  if (page && page.status === 'published') {
    return markdown(page.title, '', page.content)
  }
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
}
