// Prev/next pagination for post lists. Page 1 links to the bare path (no query).
import Link from 'next/link'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'

function href(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`
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
  const d = t(lang)
  const link = 'rounded-lg px-3 py-1.5 text-sm text-meta ring-1 ring-[var(--c-rule)] hover:text-[var(--c-heading)]'
  const disabled = 'rounded-lg px-3 py-1.5 text-sm text-meta opacity-40'

  return (
    <nav className="mt-12 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(basePath, page - 1)} className={link} rel="prev">
          ← {d.newer}
        </Link>
      ) : (
        <span className={disabled}>← {d.newer}</span>
      )}

      <span className="text-sm text-meta">{d.pageOf(page, totalPages)}</span>

      {page < totalPages ? (
        <Link href={href(basePath, page + 1)} className={link} rel="next">
          {d.older} →
        </Link>
      ) : (
        <span className={disabled}>{d.older} →</span>
      )}
    </nav>
  )
}
