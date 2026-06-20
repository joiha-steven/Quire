'use client'

// Client-side search. The server ships a LEAN index (no excerpts/images): each
// doc is { slug, title, date, terms } where `terms` is a pre-folded
// title+tags+categories string, so the payload stays small even with many posts.
// Nothing is listed until the reader types; matches are capped.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { SiteLang } from '@/types'
import { formatDate, t } from '@/lib/i18n'
import { foldAccents } from '@/lib/utils'

export type SearchDoc = { slug: string; title: string; date: string; terms: string }

const MAX_RESULTS = 50

export function SearchClient({ docs, lang, initialQuery }: { docs: SearchDoc[]; lang: SiteLang; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery)
  const needle = foldAccents(q.trim())

  const results = useMemo(() => {
    if (needle.length < 1) return []
    return docs.filter((d) => d.terms.includes(needle)).slice(0, MAX_RESULTS)
  }, [needle, docs])

  return (
    <div>
      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t(lang).searchPlaceholder}
        aria-label={t(lang).search}
        className="mb-10 w-full border-b border-[var(--c-rule)] bg-transparent pb-3 text-2xl tracking-tight outline-none placeholder:text-meta"
      />

      {needle.length < 1 ? (
        <p className="py-12 text-meta">{t(lang).searchHint}</p>
      ) : results.length === 0 ? (
        <p className="py-12 text-meta">{t(lang).searchEmpty}</p>
      ) : (
        <ul className="space-y-5">
          {results.map((d) => (
            <li key={d.slug}>
              <Link href={`/${d.slug}`} className="font-medium tracking-tight hover:text-[var(--c-heading)]">
                {d.title}
              </Link>
              <p className="mt-0.5 text-sm text-meta">{formatDate(d.date, lang)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
