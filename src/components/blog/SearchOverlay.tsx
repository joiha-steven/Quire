'use client'

// Modal search overlay opened from the header icon (no page navigation). Same
// two-layer model as the /search page: an instant, accent-insensitive local
// filter over a lean index (fetched once on open) PLUS a debounced /api/search
// body query, merged. Closes on Escape or backdrop click.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { SiteLang } from '@/types'
import type { SearchDoc } from './SearchClient'
import { formatDate, t } from '@/lib/i18n'
import { foldAccents } from '@/lib/utils'

type Hit = { slug: string; title: string; date: string }

const MAX_RESULTS = 50

export function SearchOverlay({ lang, onClose }: { lang: SiteLang; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [docs, setDocs] = useState<SearchDoc[]>([])
  const [serverHits, setServerHits] = useState<Hit[]>([])
  const needle = foldAccents(q.trim())
  const trimmed = q.trim()

  // Load the lean index once when the overlay opens.
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/search/index', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((b) => {
        if (b?.success && Array.isArray(b.data)) setDocs(b.data as SearchDoc[])
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Debounced body search on the server.
  useEffect(() => {
    if (trimmed.length < 2) return
    const ctrl = new AbortController()
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal })
        const body = await res.json()
        if (body?.success && Array.isArray(body.data)) setServerHits(body.data as Hit[])
      } catch {
        /* aborted / offline */
      }
    }, 250)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [trimmed])

  const local = useMemo(() => {
    if (needle.length < 1) return []
    return docs.filter((d) => d.terms.includes(needle)).slice(0, MAX_RESULTS)
  }, [needle, docs])

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
    <div
      className="fixed inset-0 z-[70] flex justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="h-fit w-full max-w-xl rounded-2xl border border-rule bg-bg p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(lang).searchPlaceholder}
          aria-label={t(lang).search}
          className="fs-h3 w-full border-b border-rule bg-transparent pb-3 tracking-tight outline-none placeholder:text-meta"
        />
        <div className="mt-4 max-h-[55vh] overflow-y-auto">
          {needle.length < 1 ? (
            <p className="py-8 text-center t-small text-meta">{t(lang).searchHint}</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center t-small text-meta">{t(lang).searchEmpty}</p>
          ) : (
            <ul className="space-y-4">
              {results.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/${d.slug}`}
                    onClick={onClose}
                    className="font-medium tracking-tight hover:text-heading"
                  >
                    {d.title}
                  </Link>
                  <p className="mt-0.5 t-small text-meta">{formatDate(d.date, lang)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
