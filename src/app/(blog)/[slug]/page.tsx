// Root-level detail. A slug resolves to a post or a static page (shared URL
// namespace, so at most one matches). Drafts / future-dated posts are hidden.
// The featured image is used only for SEO/social meta, never rendered in-page.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/posts'
import { getPage } from '@/lib/pages'
import { getSettings } from '@/lib/settings'
import { formatDate } from '@/lib/i18n'
import { PostContent } from '@/components/blog/PostContent'
import { isPublicallyVisible } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const [post, page] = await Promise.all([getPost(slug), getPage(slug)])
  if (post && isPublicallyVisible(post.status, post.date)) {
    const images = post.featuredImage ? [post.featuredImage] : undefined
    return {
      title: post.title,
      description: post.excerpt || undefined,
      openGraph: { title: post.title, description: post.excerpt || undefined, images, type: 'article' },
      twitter: { card: images ? 'summary_large_image' : 'summary', images },
    }
  }
  if (page && page.status === 'published') {
    const images = page.featuredImage ? [page.featuredImage] : undefined
    return {
      title: page.title,
      openGraph: { title: page.title, images, type: 'website' },
      twitter: { card: images ? 'summary_large_image' : 'summary', images },
    }
  }
  return {}
}

export default async function EntryPage({ params }: PageProps<'/[slug]'>) {
  const { slug } = await params
  const [post, page, { language }] = await Promise.all([
    getPost(slug),
    getPage(slug),
    getSettings(),
  ])

  // Post wins if visible; otherwise fall back to a published page.
  if (post && isPublicallyVisible(post.status, post.date)) {
    return (
      <article>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">{post.title}</h1>
        <p className="mt-3 text-sm text-meta">{formatDate(post.date, language)}</p>

        {(post.categories.length > 0 || post.tags.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.categories.map((c) => (
              <Link
                key={`c-${c}`}
                href={`/category/${encodeURIComponent(c)}`}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                {c}
              </Link>
            ))}
            {post.tags.map((tag) => (
              <Link
                key={`t-${tag}`}
                href={`/tag/${encodeURIComponent(tag)}`}
                className="rounded-full px-3 py-1 text-xs text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:text-neutral-400 dark:ring-neutral-700 dark:hover:bg-neutral-800"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          <PostContent markdown={post.content} />
        </div>
      </article>
    )
  }

  if (page && page.status === 'published') {
    return (
      <article>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">{page.title}</h1>
        <div className="mt-8">
          <PostContent markdown={page.content} />
        </div>
      </article>
    )
  }

  notFound()
}
