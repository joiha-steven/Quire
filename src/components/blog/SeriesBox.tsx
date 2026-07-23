// The series box shown at the top of a post that belongs to a series: the series
// title + the ordered list of parts (current one highlighted, not a link).
import Link from 'next/link'
import type { SiteLang } from '@/types'
import type { SeriesInfo } from '@/lib/series'
import { t } from '@/lib/i18n'

export function SeriesBox({ info, lang }: { info: SeriesInfo; lang: SiteLang }) {
  const tx = t(lang)
  const { name, slug, posts, currentIndex } = info
  return (
    <aside className="rounded-lg border border-rule bg-bg px-6 py-5">
      <p className="t-small text-meta">
        <Link href={`/series/${slug}`} className="link-accent font-semibold">
          {name}
        </Link>
        {` · ${tx.seriesPartPrefix} ${currentIndex + 1}/${posts.length}`}
      </p>
      <ol className="mt-4 space-y-2.5">
        {posts.map((p, i) => (
          <li key={p.slug} className="t-small leading-snug">
            {i === currentIndex ? (
              <span className="font-medium text-heading">
                {i + 1}. {p.title}
              </span>
            ) : (
              <Link href={`/${p.slug}`} className="text-meta hover:text-heading">
                {i + 1}. {p.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </aside>
  )
}
