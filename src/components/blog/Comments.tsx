'use client'

// Public comment island. The post page stays ISR/static; this fetches the comment
// tree from /api/comments with `no-store`. A just-posted comment shows INSTANTLY
// (optimistic) using the SAME `renderCommentMarkdown` the server uses — so there is
// no content drift — then the authoritative refetch replaces it and clears the
// pending overlay. On failure the optimistic comment is removed + an error shown.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import type { PublicComment, SiteLang } from '@/types'
import { t, formatDate } from '@/lib/i18n'
import { renderCommentMarkdown } from '@/lib/comment-md'
import { mergeOptimisticComments } from '@/lib/comment-tree'
import { CommentForm, SignInButton, MAX, type Draft } from './CommentForm'

type Viewer = { name: string } | null

const MAX_DEPTH = 2

// Count real (non-tombstone) comments across the whole tree, for the heading.
function countVisible(nodes: PublicComment[]): number {
  return nodes.reduce((n, c) => n + (c.deleted ? 0 : 1) + countVisible(c.replies), 0)
}

export function Comments({
  postSlug,
  lang,
  turnstile = false,
  turnstileSiteKey = '',
  googleAuth = false,
}: {
  postSlug: string
  lang: SiteLang
  turnstile?: boolean
  turnstileSiteKey?: string
  googleAuth?: boolean
}) {
  const s = t(lang)
  const [comments, setComments] = useState<PublicComment[]>([])
  const [pending, setPending] = useState<PublicComment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [viewer, setViewer] = useState<Viewer>(null)
  const oauthOn = googleAuth
  const tempId = useRef(-1) // optimistic ids count down so they never clash with real ones

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

  // Identify a signed-in commenter (only when OAuth is offered). The post page is
  // static, so the viewer is resolved client-side via the NextAuth session endpoint.
  useEffect(() => {
    if (!oauthOn) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        const json = (await res.json()) as { user?: { name?: string; email?: string } }
        const u = json?.user
        if (active && u?.email) setViewer({ name: u.name || u.email })
      } catch {
        /* logged out / offline — stay anonymous */
      }
    })()
    return () => {
      active = false
    }
  }, [oauthOn])

  // POST a comment. Show it optimistically (same renderer as the server), then
  // reconcile with an authoritative refetch and drop the pending overlay. On any
  // failure, remove the optimistic comment so the form can report the error.
  const submit = useCallback(
    async (parentId: number | null, draft: Draft, token: string | null): Promise<boolean> => {
      const id = tempId.current--
      const optimistic: PublicComment = {
        id,
        parentId,
        name: viewer?.name || draft.name.trim(),
        website: draft.website.trim() || undefined,
        provider: 'manual',
        contentHtml: renderCommentMarkdown(draft.content.slice(0, MAX)),
        createdAt: new Date().toISOString(),
        deleted: false,
        replies: [],
      }
      setPending((p) => [...p, optimistic])
      const ok = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postSlug, parentId, ...draft, turnstileToken: token }),
      })
        .then((res) => res.ok && res.json())
        .then((json) => !!json?.success)
        .catch(() => false)
      if (!ok) {
        setPending((p) => p.filter((c) => c.id !== id))
        return false
      }
      const fresh = await fetchTree()
      setComments(fresh)
      setPending((p) => p.filter((c) => c.id !== id))
      setReplyTo(null)
      return true
    },
    [postSlug, fetchTree, viewer],
  )

  // Optimistic comments overlaid on the authoritative tree, for render + count.
  const displayed = useMemo(() => mergeOptimisticComments(comments, pending), [comments, pending])
  const count = useMemo(() => countVisible(displayed), [displayed])

  return (
    <section className="mt-6">
      <h2 className="fs-h3 font-semibold text-heading">
        {s.commentsHeading}
        {count > 0 && ` (${count})`}
      </h2>

      <div className="mt-5">
        {viewer && (
          <p className="mb-2.5 t-small text-meta">
            {s.commentAs} <span className="font-semibold text-heading">{viewer.name}</span>
            {' · '}
            <button type="button" onClick={() => signOut({ redirectTo: window.location.href })} className="hover:text-heading">
              {s.commentSignOut}
            </button>
          </p>
        )}
        <CommentForm
          lang={lang}
          onSubmit={(d, tok) => submit(null, d, tok)}
          turnstile={turnstile}
          turnstileSiteKey={turnstileSiteKey}
          viewer={!!viewer}
        />
        {!viewer && oauthOn && (
          <div className="mt-3 flex flex-wrap gap-2">
            {googleAuth && <SignInButton label={s.commentSignInGoogle} provider="google" />}
          </div>
        )}
      </div>

      {loaded && displayed.length === 0 ? (
        <p className="mt-6 t-small text-meta">{s.commentsEmpty}</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {displayed.map((c) => (
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
              viewerMode={!!viewer}
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
  viewerMode,
}: {
  comment: PublicComment
  depth: number
  lang: SiteLang
  replyTo: number | null
  setReplyTo: (id: number | null) => void
  onReply: (parentId: number, draft: Draft, token: string | null) => Promise<boolean>
  turnstile: boolean
  turnstileSiteKey: string
  viewerMode: boolean
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
            viewer={viewerMode}
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
              viewerMode={viewerMode}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
