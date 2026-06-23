'use client'

// Public comment island. The post page stays ISR/static; this fetches the comment
// tree from /api/comments with `no-store`, so a just-posted comment shows on the
// next load with NO cache in the way. After a successful post we simply refetch —
// authoritative + instant, no optimistic reconciliation to get wrong.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PublicComment, SiteLang } from '@/types'
import { t, formatDate } from '@/lib/i18n'
import { Turnstile } from './Turnstile'

const MAX = 1000
const MAX_DEPTH = 2

type Draft = { name: string; email: string; website: string; content: string }
const EMPTY: Draft = { name: '', email: '', website: '', content: '' }

// Count real (non-tombstone) comments across the whole tree, for the heading.
function countVisible(nodes: PublicComment[]): number {
  return nodes.reduce((n, c) => n + (c.deleted ? 0 : 1) + countVisible(c.replies), 0)
}

const inputClass =
  't-small w-full rounded-lg border border-rule bg-bg px-3 py-2 text-text outline-none focus:border-heading'

export function Comments({
  postSlug,
  lang,
  turnstile = false,
  turnstileSiteKey = '',
}: {
  postSlug: string
  lang: SiteLang
  turnstile?: boolean
  turnstileSiteKey?: string
}) {
  const s = t(lang)
  const [comments, setComments] = useState<PublicComment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [replyTo, setReplyTo] = useState<number | null>(null)

  // Fetch the tree (no setState) so callers decide when to commit it to state —
  // keeps setState out of the synchronous effect body (deferred, after await).
  const fetchTree = useCallback(async (): Promise<PublicComment[]> => {
    try {
      const res = await fetch(`/api/comments?post=${encodeURIComponent(postSlug)}`, { cache: 'no-store' })
      const json = await res.json()
      if (json?.success) return (json.data.comments ?? []) as PublicComment[]
    } catch {
      /* leave the list as-is on a transient error */
    }
    return []
  }, [postSlug])

  useEffect(() => {
    let active = true
    ;(async () => {
      const data = await fetchTree()
      if (active) {
        setComments(data)
        setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
  }, [fetchTree])

  // POST a comment; on success refetch the tree and close any reply form.
  const submit = useCallback(
    async (parentId: number | null, draft: Draft, token: string | null): Promise<boolean> => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postSlug, parentId, ...draft, turnstileToken: token }),
      }).catch(() => null)
      if (!res || !res.ok) return false
      const json = await res.json().catch(() => null)
      if (!json?.success) return false
      setComments(await fetchTree())
      setReplyTo(null)
      return true
    },
    [postSlug, fetchTree],
  )

  const count = useMemo(() => countVisible(comments), [comments])

  return (
    <section className="mt-6">
      <h2 className="fs-h3 font-semibold tracking-tight text-heading">
        {s.commentsHeading}
        {count > 0 && ` (${count})`}
      </h2>

      <div className="mt-5">
        <CommentForm
          lang={lang}
          onSubmit={(d, tok) => submit(null, d, tok)}
          turnstile={turnstile}
          turnstileSiteKey={turnstileSiteKey}
        />
      </div>

      {loaded && comments.length === 0 ? (
        <p className="mt-6 t-small text-meta">{s.commentsEmpty}</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {comments.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              depth={0}
              lang={lang}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onReply={submit}
              turnstile={turnstile}
              turnstileSiteKey={turnstileSiteKey}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CommentNode({
  comment,
  depth,
  lang,
  replyTo,
  setReplyTo,
  onReply,
  turnstile,
  turnstileSiteKey,
}: {
  comment: PublicComment
  depth: number
  lang: SiteLang
  replyTo: number | null
  setReplyTo: (id: number | null) => void
  onReply: (parentId: number, draft: Draft, token: string | null) => Promise<boolean>
  turnstile: boolean
  turnstileSiteKey: string
}) {
  const s = t(lang)
  const canReply = depth < MAX_DEPTH
  return (
    <li>
      <div className="t-small">
        {comment.deleted ? (
          <p className="italic text-meta">{s.commentDeleted}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-heading">
                {comment.website ? (
                  <a href={comment.website} target="_blank" rel="nofollow ugc noopener" className="hover:text-link">
                    {comment.name}
                  </a>
                ) : (
                  comment.name
                )}
              </span>
              <span className="text-meta">{formatDate(comment.createdAt, lang)}</span>
            </div>
            <div
              className="mt-1.5 text-text [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: comment.contentHtml }}
            />
            {canReply && (
              <button
                type="button"
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                className="mt-1.5 text-meta hover:text-heading"
              >
                {replyTo === comment.id ? s.commentCancel : s.commentReply}
              </button>
            )}
          </>
        )}
      </div>

      {replyTo === comment.id && canReply && (
        <div className="mt-3">
          <CommentForm
            lang={lang}
            onSubmit={(d, tok) => onReply(comment.id, d, tok)}
            turnstile={turnstile}
            turnstileSiteKey={turnstileSiteKey}
            autoFocus
          />
        </div>
      )}

      {comment.replies.length > 0 && (
        <ul className="mt-5 space-y-5 border-l border-rule pl-4">
          {comment.replies.map((r) => (
            <CommentNode
              key={r.id}
              comment={r}
              depth={depth + 1}
              lang={lang}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onReply={onReply}
              turnstile={turnstile}
              turnstileSiteKey={turnstileSiteKey}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function CommentForm({
  lang,
  onSubmit,
  turnstile,
  turnstileSiteKey,
  autoFocus,
}: {
  lang: SiteLang
  onSubmit: (draft: Draft, token: string | null) => Promise<boolean>
  turnstile: boolean
  turnstileSiteKey: string
  autoFocus?: boolean
}) {
  const s = t(lang)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const onToken = useCallback((tk: string | null) => setToken(tk), [])

  // Turnstile (when on) must be solved before the content step — and identity
  // must be filled first so the gate is meaningful.
  const showWidget = turnstile && !!turnstileSiteKey
  const identityOk = draft.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
  const gateOpen = !showWidget || !!token
  const valid = identityOk && draft.content.trim() && gateOpen

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(false)
    const okied = await onSubmit({ ...draft, content: draft.content.slice(0, MAX) }, token)
    setBusy(false)
    if (okied) {
      setDraft(EMPTY)
      setToken(null) // tokens are single-use — force a fresh solve for the next one
    } else {
      setError(true)
    }
  }

  return (
    <form onSubmit={handle} className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <input
          className={inputClass}
          placeholder={s.commentName}
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          autoFocus={autoFocus}
          maxLength={80}
        />
        <input
          className={inputClass}
          type="email"
          placeholder={`${s.commentEmail} · ${s.commentEmailNote}`}
          value={draft.email}
          onChange={(e) => set('email', e.target.value)}
          maxLength={120}
        />
        <input
          className={inputClass}
          placeholder={s.commentWebsite}
          value={draft.website}
          onChange={(e) => set('website', e.target.value)}
        />
      </div>

      {/* Gate: with Turnstile on, the widget appears once identity is filled and
          must be solved before the comment box is shown. */}
      {showWidget && !gateOpen ? (
        identityOk && <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
      ) : (
        <>
          <textarea
            className={`${inputClass} min-h-[6rem] resize-y`}
            placeholder={s.commentBody}
            value={draft.content}
            onChange={(e) => set('content', e.target.value.slice(0, MAX))}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="t-small text-meta">
              {s.commentFormatHint} · {draft.content.length}/{MAX}
            </span>
            <button
              type="submit"
              disabled={!valid || busy}
              className="t-small rounded-lg border border-heading bg-heading px-4 py-2 font-medium text-bg transition-opacity disabled:opacity-40"
            >
              {busy ? s.commentSubmitting : s.commentSubmit}
            </button>
          </div>
        </>
      )}
      {error && <p className="t-small text-meta">{s.commentError}</p>}
    </form>
  )
}
