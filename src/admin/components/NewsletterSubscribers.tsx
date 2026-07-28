// Newsletter → People: who is on the list, and what each address has actually been
// sent. Counts come from the `newsletter_sends` log, so "5 emails" means five emails
// really left the server, not five attempts. Open rate covers broadcasts only (the
// tracking pixel rides on those); a dash means nothing to measure yet.
import { useEffect, useState } from 'react'
import type { ApiResponse } from '@/types'
import { StatCard, TableFrame, THEAD, TROW, EmptyState } from './kit'
import { useAdminT } from './I18nProvider'

type Stats = { sent: number; failed: number; opened: number; broadcasts: number; lastAt?: string; lastError?: string }
type Subscriber = {
  id: number
  email: string
  status: 'pending' | 'confirmed' | 'unsubscribed'
  createdAt: string
  stats: Stats | null
}
type Counts = { confirmed: number; pending: number; unsubscribed: number }

const shortDate = (iso?: string) => (iso ? iso.slice(0, 10) : '—')

export function NewsletterSubscribers() {
  const t = useAdminT()
  const [subs, setSubs] = useState<Subscriber[] | null>(null)
  const [counts, setCounts] = useState<Counts>({ confirmed: 0, pending: 0, unsubscribed: 0 })

  useEffect(() => {
    fetch('/api/subscribers')
      .then((r) => r.json() as Promise<ApiResponse<{ subscribers: Subscriber[]; counts: Counts }>>)
      .then((j) => {
        if (j.success && j.data) {
          setSubs(j.data.subscribers)
          setCounts(j.data.counts)
        } else setSubs([])
      })
      .catch(() => setSubs([]))
  }, [])

  async function removeSub(id: number) {
    const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' })
    const j = (await res.json()) as ApiResponse<unknown>
    if (j.success) setSubs((s) => (s ? s.filter((x) => x.id !== id) : s))
  }

  if (!subs) return <p className="text-sm text-neutral-400">{t.loading}</p>

  const openRate = (s: Stats | null) =>
    s && s.broadcasts > 0 ? `${Math.round((s.opened / s.broadcasts) * 100)}%` : '—'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t.nlConfirmed} value={counts.confirmed} />
        <StatCard label={t.nlPending} value={counts.pending} />
        <StatCard label={t.nlUnsub} value={counts.unsubscribed} />
      </div>

      {subs.length === 0 ? (
        <EmptyState title={t.nlNoSubs} description={t.nlNoSubsHint} />
      ) : (
        <TableFrame>
          <thead className={THEAD}>
            <tr>
              <th className="px-4 py-2.5 font-medium">{t.nlColEmail}</th>
              <th className="px-4 py-2.5 font-medium">{t.nlColStatus}</th>
              <th className="px-4 py-2.5 font-medium">{t.nlColJoined}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t.nlColSent}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t.nlColOpenRate}</th>
              <th className="px-4 py-2.5 font-medium">{t.nlColLastSend}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className={TROW}>
                {/* max-w, not max-w-0: the latter collapses the column to its minimum
                    and truncates every address even on a near-empty table. */}
                <td className="max-w-[22rem] truncate px-4 py-2.5" title={s.email}>{s.email}</td>
                <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">{s.status}</td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-500 dark:text-neutral-400">{shortDate(s.createdAt)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {s.stats?.sent ?? 0}
                  {/* Failures are the whole point of keeping the log — never hide them. */}
                  {s.stats && s.stats.failed > 0 && (
                    <span className="ml-1.5 text-xs text-neutral-500 dark:text-neutral-400" title={s.stats.lastError}>
                      +{s.stats.failed} {t.nlFailedSuffix}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{openRate(s.stats)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-500 dark:text-neutral-400">{shortDate(s.stats?.lastAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => removeSub(s.id)}
                    className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                    aria-label={t.nlDeleteSub}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </div>
  )
}
