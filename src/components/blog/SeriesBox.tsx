// The series box shown at the top of a post that belongs to a series: the ordered
// list of parts (current one highlighted, not a link) + prev/next within the series.
import Link from 'next/link'
import type { SiteLang } from '@/types'
import type { SeriesInfo } from '@/lib/series'
import { t } from '@/lib/i18n'

export function SeriesBox({ info, lang }: { info: SeriesInfo; lang: SiteLang }) {
  const tx = t(lang)
  const { name, slug, posts, currentIndex, prev, next } = info
  return (
    <aside className="rounded-lg border border-rule bg-bg p-5">
      <p className="t-small text-meta">
        <Link href={`/series/${slug}`} className="link-accent font-semibold">
          {name}
        </Link>
        {` · ${tx.seriesPartPrefix} ${currentIndex + 1}/${posts.length}`}
      </p>
      <ol className="mt-3 space-y-1.5">
        {posts.map((p, i) => (
          <li key={p.slug} className="t-small">
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
      {(prev || next) && (
        <div className="mt-4 flex justify-between gap-4 t-small">
          {prev ? (
            <Link href={`/${prev.slug}`} className="link-accent hover:text-heading">
              ← {tx.seriesPrev}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/${next.slug}`} className="link-accent hover:text-heading">
              {tx.seriesNext} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </aside>
  )
}
