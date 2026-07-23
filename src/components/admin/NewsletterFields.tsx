'use client'

// Admin newsletter panel (Settings → Integrations): SMTP config + subscriber list.
// Self-contained — reads GET /api/mail + GET /api/subscribers, saves via POST /api/mail,
// deletes via DELETE /api/subscribers/[id]. Independent of the settings Save bar.
import { useEffect, useState } from 'react'
import type { ApiResponse } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

type MailStatus = { host: string; port: number; user: string; from: string; secure: boolean; hasPass: boolean; configured: boolean }
type Subscriber = { id: number; email: string; status: 'pending' | 'confirmed' | 'unsubscribed'; createdAt: string }
type Counts = { confirmed: number; pending: number; unsubscribed: number }

export function NewsletterFields() {
  const t = useAdminT()
  const { notify } = useToast()
  const [cfg, setCfg] = useState<MailStatus | null>(null)
  const [pass, setPass] = useState('')
  const [subs, setSubs] = useState<Subscriber[]>([])
  const [counts, setCounts] = useState<Counts>({ confirmed: 0, pending: 0, unsubscribed: 0 })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/mail')
      .then((r) => r.json() as Promise<ApiResponse<MailStatus>>)
      .then((j) => j.success && j.data && setCfg(j.data))
      .catch(() => {})
    fetch('/api/subscribers')
      .then((r) => r.json() as Promise<ApiResponse<{ subscribers: Subscriber[]; counts: Counts }>>)
      .then((j) => {
        if (j.success && j.data) {
          setSubs(j.data.subscribers)
          setCounts(j.data.counts)
        }
      })
      .catch(() => {})
  }, [])

  function field<K extends keyof MailStatus>(k: K, v: MailStatus[K]) {
    setCfg((c) => (c ? { ...c, [k]: v } : c))
  }

  async function save() {
    if (!cfg) return
    setBusy(true)
    try {
      const body: Record<string, unknown> = { host: cfg.host, port: cfg.port, user: cfg.user, from: cfg.from, secure: cfg.secure }
      if (pass) body.pass = pass
      const res = await fetch('/api/mail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json()) as ApiResponse<unknown>
      notify(j.success ? t.nlSmtpSaved : t.saveFailed, j.success ? 'success' : 'error')
      if (j.success) setPass('')
    } finally {
      setBusy(false)
    }
  }

  async function removeSub(id: number) {
    const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' })
    const j = (await res.json()) as ApiResponse<unknown>
    if (j.success) setSubs((s) => s.filter((x) => x.id !== id))
  }

  if (!cfg) return <p className="text-sm text-neutral-400">{t.loading}</p>

  return (
    <div className="space-y-5">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.nlSmtpHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t.nlSmtpHost} value={cfg.host} onChange={(e) => field('host', e.target.value)} placeholder="smtp.example.com" />
        <Input label={t.nlSmtpPort} type="number" value={String(cfg.port)} onChange={(e) => field('port', Number(e.target.value) || 587)} />
        <Input label={t.nlSmtpUser} value={cfg.user} onChange={(e) => field('user', e.target.value)} autoComplete="off" />
        <Input label={t.nlSmtpPass} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={cfg.hasPass ? '••••••••' : ''} autoComplete="new-password" />
        <Input label={t.nlSmtpFrom} value={cfg.from} onChange={(e) => field('from', e.target.value)} placeholder="Blog <hi@example.com>" />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input type="checkbox" checked={cfg.secure} onChange={(e) => field('secure', e.target.checked)} />
        {t.nlSmtpSecure}
      </label>
      <Button onClick={save} disabled={busy}>{t.nlSaveSmtp}</Button>

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t.nlSubscribers}: {counts.confirmed} {t.nlConfirmed} · {counts.pending} {t.nlPending} · {counts.unsubscribed} {t.nlUnsub}
        </p>
        {subs.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">{t.nlNoSubs}</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{s.email}</span>
                <span className="shrink-0 text-xs text-neutral-500">{s.status}</span>
                <button type="button" onClick={() => removeSub(s.id)} className="shrink-0 text-neutral-400 hover:text-neutral-900 dark:hover:text-white" aria-label={t.nlDeleteSub}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
