// Single post preview used in lists. `lead` promotes the newest post to the h1
// role so a list has one clear entry point; everything else stays at h2. Sizes
// always come from the type roles, never a hardcoded value.
import Link from 'next/link'
import type { Post, SiteLang } from '@/types'
import { termSlug } from '@/lib/taxonomy'
import { formatDate, t } from '@/lib/i18n'

export function PostCard({
  post,
  lang,
  showReadingTime = false,
  showCategory = false,
  lead = false,
}: {
  post: Post
  lang: SiteLang
  showReadingTime?: boolean
  showCategory?: boolean
  lead?: boolean
}) {
  const category = showCategory ? post.categories[0] : undefined
  const Title = lead ? 'h1' : 'h2'
  return (
    // `reveal` eases the card in as it scrolls into view (motion engine; fully
    // visible when motion is off / unsupported — see globals.css).
    <article className="reveal group">
      <p className="t-small text-meta">
        {category && (
          <>
            <Link href={`/category/${termSlug(category)}`} className="text-heading hover:text-meta">
              {category}
            </Link>
            {' · '}
          </>
        )}
        {formatDate(post.date, lang)}
        {showReadingTime && post.readingMinutes
          ? ` · ${post.readingMinutes} ${t(lang).readingSuffix}`
          : ''}
      </p>
      <Title className={`mt-2 ${lead ? 'fs-h1' : 'fs-h2'} font-semibold`}>
        <Link
          href={`/${post.slug}`}
          className="decoration-accent underline-offset-4 group-hover:underline"
        >
          {post.title}
        </Link>
      </Title>
      {post.excerpt && <p className="mt-3 t-body text-text">{post.excerpt}</p>}
    </article>
  )
}
