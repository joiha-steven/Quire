// Single post preview used in lists.
import Link from 'next/link'
import type { Post, SiteLang } from '@/types'
import { formatDate, t } from '@/lib/i18n'

export function PostCard({
  post,
  lang,
  showReadingTime = false,
}: {
  post: Post
  lang: SiteLang
  showReadingTime?: boolean
}) {
  return (
    <article>
      <h2 className="fs-h1 font-semibold tracking-tight">
        <Link href={`/${post.slug}`} className="hover:text-meta">
          {post.title}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-meta">
        {formatDate(post.date, lang)}
        {showReadingTime && post.readingMinutes
          ? ` · ${post.readingMinutes} ${t(lang).readingSuffix}`
          : ''}
      </p>
      {post.excerpt && (
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-text">
          {post.excerpt}
        </p>
      )}
    </article>
  )
}
