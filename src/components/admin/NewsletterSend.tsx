'use client'

// Newsletter → Send: pick a published post, look at the EXACT email that will go out,
// then send it. The preview is the real `broadcastEmail()` HTML rendered in a sandboxed
// iframe (not a mock-up), because reviewing something other than what ships is worse
// than not reviewing at all.
//
// Nothing sends automatically: the cron only publishes. A post that already has
// successful sends needs the resend checkbox before the button unlocks.
import { useEffect, useState } from 'react'
import type { ApiResponse } from '@/types'
import { Select, Card } from './kit'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

type Stats = { sent: number; failed: number; opened: number; broadcasts: number; lastAt?: string }
export type SendablePost = { slug: string; title: string; date: string; stats: Stats | null }

type Preview = { subject: string; html: string }
type SendResult = { sent: number; failed: number; recipients: number }

export function NewsletterSend({ posts }: { posts: SendablePost[] }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [slug, setSlug] = useState(posts[0]?.slug ?? '')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [resend, setResend] = useState(false)
  const [sending, setSending] = useState(false)
  // Sent counts come from the server on load; a send in this session updates them here
  // so the button locks again without a page reload.
  const [justSent, setJustSent] = useState<Record<string, SendResult>>({})

  const post = posts.find((p) => p.slug === slug) ?? null
  const priorSent = (justSent[slug]?.sent ?? 0) + (post?.stats?.sent ?? 0)
  const alreadySent = priorSent > 0

  // Re-confirming a resend belongs to the act of switching posts, not to the fetch —
  // so it resets in the change handler and the effect stays a pure data sync.
  function pick(next: string) {
    setSlug(next)
    setResend(false)
  }

  useEffect(() => {
    if (!slug) return
    const ctrl = new AbortController()
    fetch(`/api/broadcast?slug=${encodeURIComponent(slug)}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<ApiResponse<Preview>>)
      .then((j) => {
        setPreview(j.success && j.data ? j.data : null)
        setLoading(false)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [slug])

  async function send() {
    if (!slug || sending) return
    if (!confirm(t.nlSendConfirm.replace('{title}', post?.title ?? slug))) return
    setSending(true)
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, force: resend }),
      })
      const j = (await res.json()) as ApiResponse<SendResult>
      if (j.success && j.data) {
        setJustSent((m) => ({ ...m, [slug]: j.data as SendResult }))
        setResend(false)
        notify(t.nlSendDone.replace('{sent}', String(j.data.sent)).replace('{total}', String(j.data.recipients)), 'success')
      } else {
        notify(`${t.nlSendFailed}: ${j.success ? '' : j.error}`, 'error')
      }
    } catch {
      notify(t.nlSendFailed, 'error')
    } finally {
      setSending(false)
    }
  }

  if (posts.length === 0) return <p className="text-sm text-neutral-400">{t.nlNoPosts}</p>

  const result = justSent[slug]

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card title={t.nlPickPost}>
        <div className="space-y-4">
          <Select value={slug} onChange={(e) => pick(e.target.value)} aria-label={t.nlPickPost} wrapClassName="flex w-full" className="w-full">
            {posts.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.date.slice(0, 10)} — {p.title}
                {(p.stats?.sent ?? 0) > 0 ? ` (${t.nlAlreadySentShort})` : ''}
              </option>
            ))}
          </Select>

          {alreadySent && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-neutral-600 dark:text-neutral-400">
                {t.nlAlreadySent.replace('{n}', String(priorSent))}
              </p>
              <label className="mt-2 flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} />
                {t.nlResendConfirm}
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={send} disabled={sending || !slug || (alreadySent && !resend)}>
              {t.nlSendButton}
            </Button>
            {result && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {t.nlSendDone.replace('{sent}', String(result.sent)).replace('{total}', String(result.recipients))}
                {result.failed > 0 && ` · ${result.failed} ${t.nlFailedSuffix}`}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.nlSendHint}</p>
        </div>
      </Card>

      <Card title={t.nlPreview}>
        {loading ? (
          <p className="text-sm text-neutral-400">{t.loading}</p>
        ) : !preview ? (
          <p className="text-sm text-neutral-400">{t.nlPreviewFailed}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">{t.nlSubjectLabel}: </span>
              <span className="font-medium">{preview.subject}</span>
            </p>
            {/* sandbox with no allow-* tokens: the email HTML cannot run scripts, submit
                forms or navigate the admin. It is only ever rendered, never trusted. */}
            <iframe
              title={t.nlPreview}
              sandbox=""
              srcDoc={preview.html}
              className="h-[26rem] w-full rounded-lg border border-neutral-200 bg-white dark:border-neutral-800"
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.nlPreviewHint}</p>
          </div>
        )}
      </Card>
    </div>
  )
}
