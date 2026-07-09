// Compact list of related posts shown at the end of an article.
import Link from 'next/link'
import type { Post, SiteLang } from '@/types'
import { formatDate, t } from '@/lib/i18n'

export function RelatedPosts({ posts, lang }: { posts: Post[]; lang: SiteLang }) {
  if (!posts.length) return null
  return (
    <section>
      <h2 className="mb-5 t-small font-semibold text-meta">{t(lang).relatedTitle}</h2>
      <ul className="space-y-4">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={`/${p.slug}`} className="font-medium hover:text-heading">
              {p.title}
            </Link>
            <p className="mt-0.5 t-small text-meta">{formatDate(p.date, lang)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
