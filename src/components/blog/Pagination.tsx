// Numbered pagination: 1 2 3 … last. Current page is highlighted, gaps show an
// ellipsis. Page 1 links to the bare path; deeper pages use a clean `/page/N`
// path segment (no `?query`) so the URLs stay SEO-friendly.
import Link from 'next/link'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'

function href(basePath: string, page: number): string {
  if (page <= 1) return basePath
  const base = basePath === '/' ? '' : basePath
  return `${base}/page/${page}`
}

// A 3-wide window that always keeps page 1 and the last page in view, with
// 'gap' markers wherever numbers are skipped.
function pageItems(current: number, total: number): (number | 'gap')[] {
  let start = Math.max(1, current - 1)
  let end = Math.min(total, current + 1)
  if (current <= 2) end = Math.min(total, 3)
  if (current >= total - 1) start = Math.max(1, total - 2)

  const items: (number | 'gap')[] = []
  if (start > 1) {
    items.push(1)
    if (start > 2) items.push('gap')
  }
  for (let p = start; p <= end; p++) items.push(p)
  if (end < total) {
    if (end < total - 1) items.push('gap')
    items.push(total)
  }
  return items
}

export function Pagination({
  basePath,
  page,
  totalPages,
  lang,
}: {
  basePath: string
  page: number
  totalPages: number
  lang: SiteLang
}) {
  if (totalPages <= 1) return null
  const label = t(lang).pageLabel
  const base = 'min-w-9 rounded-lg px-3 py-1.5 text-center t-small'

  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      {pageItems(page, totalPages).map((it, i) =>
        it === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 t-small text-meta" aria-hidden>
            …
          </span>
        ) : it === page ? (
          <span key={it} aria-current="page" className={`${base} font-semibold text-heading ring-1 ring-rule`}>
            {it}
          </span>
        ) : (
          <Link key={it} href={href(basePath, it)} aria-label={`${label} ${it}`} className={`${base} text-meta hover:text-heading`}>
            {it}
          </Link>
        ),
      )}
    </nav>
  )
}
