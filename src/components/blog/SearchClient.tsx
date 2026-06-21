'use client'

// Public search, two layers merged:
//  1. LOCAL — the server ships a lean pre-folded index ({ slug, title, date,
//     terms } where terms = folded title+tags+categories). Filtered in memory on
//     every keystroke: instant, offline, accent-insensitive.
//  2. SERVER — a debounced /api/search call runs a Postgres full-text query over
//     title + BODY (the lean index can't carry bodies), so matches inside the
//     article text surface too. Body-only hits are appended after the local ones.
// Nothing is listed until the reader types; matches are capped.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { SiteLang } from '@/types'
import { formatDate, t } from '@/lib/i18n'
import { foldAccents } from '@/lib/utils'

export type SearchDoc = { slug: string; title: string; date: string; terms: string }
type Hit = { slug: string; title: string; date: string }

const MAX_RESULTS = 50

export function SearchClient({ docs, lang, initialQuery }: { docs: SearchDoc[]; lang: SiteLang; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery)
  const [serverHits, setServerHits] = useState<Hit[]>([])
  const needle = foldAccents(q.trim())

  // Instant local matches (title/tags/categories).
  const local = useMemo(() => {
    if (needle.length < 1) return []
    return docs.filter((d) => d.terms.includes(needle)).slice(0, MAX_RESULTS)
  }, [needle, docs])

  // Debounced body search on the server. Aborts the in-flight request when the
  // query changes so only the latest response is applied.
  const trimmed = q.trim()
  useEffect(() => {
    if (trimmed.length < 2) return
    const ctrl = new AbortController()
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal })
        const body = await res.json()
        if (body?.success && Array.isArray(body.data)) setServerHits(body.data as Hit[])
      } catch {
        /* aborted or offline — keep local results only */
      }
    }, 250)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [trimmed])

  // Merge: local first (title hits), then server body-hits not already shown.
  // Server hits only count once the query is long enough to have fired a fetch,
  // so stale results from a previous longer query never linger.
  const results = useMemo(() => {
    const seen = new Set(local.map((d) => d.slug))
    const merged: Hit[] = local.map((d) => ({ slug: d.slug, title: d.title, date: d.date }))
    if (trimmed.length >= 2) {
      for (const h of serverHits) {
        if (!seen.has(h.slug)) {
          seen.add(h.slug)
          merged.push(h)
        }
      }
    }
    return merged.slice(0, MAX_RESULTS)
  }, [local, serverHits, trimmed])

  return (
    <div>
      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t(lang).searchPlaceholder}
        aria-label={t(lang).search}
        className="mb-10 w-full border-b border-rule bg-transparent pb-3 text-2xl tracking-tight outline-none placeholder:text-meta"
      />

      {needle.length < 1 ? (
        <p className="py-12 text-meta">{t(lang).searchHint}</p>
      ) : results.length === 0 ? (
        <p className="py-12 text-meta">{t(lang).searchEmpty}</p>
      ) : (
        <ul className="space-y-5">
          {results.map((d) => (
            <li key={d.slug}>
              <Link href={`/${d.slug}`} className="font-medium tracking-tight hover:text-heading">
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
