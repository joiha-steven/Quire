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
  month,
}: {
  post: Post
  lang: SiteLang
  showReadingTime?: boolean
  showCategory?: boolean
  lead?: boolean
  month?: string // set on a month's FIRST card ('YYYY-MM'); the timeline highlights the visible one
}) {
  const category = showCategory ? post.categories[0] : undefined
  const Title = lead ? 'h1' : 'h2'
  return (
    // `reveal` eases the card in as it scrolls into view (motion engine; fully
    // visible when motion is off / unsupported — see globals.css). `data-lead` lets a
    // grid layout span the lead card across all columns.
    <article className="reveal" data-lead={lead ? '' : undefined} data-month={month}>
      {/* Thumbnail — only posts WITH a featured image; hidden in list mode, shown in
          grid mode (globals.css `.card-thumb`). Posts without one stay text-only. */}
      {post.featuredImage && (
        <Link href={`/${post.slug}`} className="card-thumb" aria-hidden tabIndex={-1}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.featuredImage} alt="" loading="lazy" />
        </Link>
      )}
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
      {/* Title + excerpt are the article's own words — the reading font, like the
          post page. The meta line above stays chrome (Inter). */}
      <Title className={`reading-font mt-2 ${lead ? 'fs-h1' : 'fs-h2'} font-semibold`}>
        <Link
          href={`/${post.slug}`}
          className="link-accent"
        >
          {post.title}
        </Link>
      </Title>
      {post.excerpt && <p className="reading-font mt-3 t-body text-text">{post.excerpt}</p>}
    </article>
  )
}
