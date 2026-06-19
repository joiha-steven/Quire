// Root-level detail. A slug resolves to a post or a static page (shared URL
// namespace, so at most one matches). Drafts / future-dated posts are hidden.
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/posts'
import { getPage } from '@/lib/pages'
import { getSettings } from '@/lib/settings'
import { formatDate } from '@/lib/i18n'
import { PostContent } from '@/components/blog/PostContent'
import { isPublicallyVisible } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function EntryPage({ params }: PageProps<'/[slug]'>) {
  const { slug } = await params
  const [post, page, { language }] = await Promise.all([
    getPost(slug),
    getPage(slug),
    getSettings(),
  ])

  // Post wins if visible; otherwise fall back to a published page.
  if (post && isPublicallyVisible(post.status, post.date)) {
    const full = post.imageDisplay === 'full' && post.featuredImage
    return (
      <article>
        {full && (
          <div className="relative left-1/2 mb-8 w-screen -translate-x-1/2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.featuredImage} alt={post.title} className="h-auto w-full" />
          </div>
        )}

        <h1 className="text-3xl font-bold leading-tight tracking-tight">{post.title}</h1>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{formatDate(post.date, language)}</p>

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

        {!full && post.featuredImage && (
          <Image
            src={post.featuredImage}
            alt={post.title}
            width={1280}
            height={720}
            className="mt-8 h-auto w-full rounded-lg"
            unoptimized
          />
        )}

        <div className="mt-8">
          <PostContent markdown={post.content} />
        </div>
      </article>
    )
  }

  if (page && page.status === 'published') {
    const full = page.imageDisplay === 'full' && page.featuredImage
    return (
      <article>
        {full && (
          <div className="relative left-1/2 mb-8 w-screen -translate-x-1/2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.featuredImage} alt={page.title} className="h-auto w-full" />
          </div>
        )}

        <h1 className="text-3xl font-bold leading-tight tracking-tight">{page.title}</h1>

        {!full && page.featuredImage && (
          <Image
            src={page.featuredImage}
            alt={page.title}
            width={1280}
            height={720}
            className="mt-8 h-auto w-full rounded-lg"
            unoptimized
          />
        )}

        <div className="mt-8">
          <PostContent markdown={page.content} />
        </div>
      </article>
    )
  }

  notFound()
}
