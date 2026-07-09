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
    // `reveal` eases the card in as it scrolls into view (motion engine; fully
    // visible when motion is off / unsupported — see globals.css).
    <article className="reveal">
      <h2 className="fs-h2 font-semibold">
        <Link href={`/${post.slug}`} className="hover:text-meta">
          {post.title}
        </Link>
      </h2>
      <p className="mt-1 t-small text-meta">
        {formatDate(post.date, lang)}
        {showReadingTime && post.readingMinutes
          ? ` · ${post.readingMinutes} ${t(lang).readingSuffix}`
          : ''}
      </p>
      {post.excerpt && (
        <p className="mt-3 t-body text-text">
          {post.excerpt}
        </p>
      )}
    </article>
  )
}
