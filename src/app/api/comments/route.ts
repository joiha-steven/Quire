// Public comments API.
//   GET  /api/comments?post=<slug> -> the rendered comment tree (no email).
//   POST /api/comments             -> create a comment (manual identity in Phase A).
// Both are PUBLIC (in middleware's isPublicApi) so a logged-out reader can use them.
// `force-no-store` makes the db reads LIVE: a just-posted comment shows on the next
// fetch with NO cache in the way (the whole point of the client-island design — the
// post page stays ISR, comments load fresh here). No revalidatePath is needed.

import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { getCommentTree, addComment, CommentInputError, MAX_COMMENT_LEN } from '@/lib/comments'
import { getPost } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { getCommenter } from '@/lib/auth'
import { verifyTurnstile } from '@/lib/turnstile'
import { getCommentEnv } from '@/lib/comment-env'
import { isPublicallyVisible } from '@/lib/utils'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A best-effort, per-instance sliding-window limiter (real protection comes from
// Turnstile in Phase B; this just blunts trivial floods). Keyed by client IP.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 6
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > MAX_PER_WINDOW
}

// Keep only an http(s) URL; anything else (incl. javascript:) becomes empty.
function cleanWebsite(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : ''
  } catch {
    return ''
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    const slug = new URL(req.url).searchParams.get('post')?.trim()
    const { comments } = await getSettings()
    if (!comments.enabled || !slug) {
      logRequest(req, 200, start)
      return ok({ comments: [] })
    }
    const tree = await getCommentTree(slug)
    logRequest(req, 200, start)
    return ok({ comments: tree })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to load comments', 500)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    const { comments } = await getSettings()
    if (!comments.enabled) {
      logRequest(req, 403, start)
      return fail('Comments are disabled', 403)
    }

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    // Country is best-effort from the edge (Vercel only); absent off-platform.
    const country = (req.headers.get('x-vercel-ip-country') ?? '').trim()
    if (rateLimited(ip)) {
      logRequest(req, 429, start)
      return fail('Too many comments — slow down a moment', 429)
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const postSlug = typeof body.postSlug === 'string' ? body.postSlug.trim() : ''
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const parentId = typeof body.parentId === 'number' ? body.parentId : null
    const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : ''

    if (!content) return fail('Comment cannot be empty', 400)
    if (content.length > MAX_COMMENT_LEN) return fail(`Comment must be under ${MAX_COMMENT_LEN} characters`, 400)

    // Only accept comments on a published, publicly-visible post.
    const post = await getPost(postSlug)
    if (!post || !isPublicallyVisible(post.status, post.date)) return fail('Post not found', 404)

    // Identity: a signed-in commenter (Google) is TRUSTED — their
    // name/email/provider come from the session, no Turnstile. Otherwise it's a
    // manual comment: name + valid email required, Turnstile enforced if on.
    const commenter = await getCommenter()
    let identity: { name: string; email: string; website: string; provider: 'manual' | 'google' }
    if (commenter) {
      identity = { name: commenter.name.slice(0, 80), email: commenter.email, website: '', provider: commenter.provider }
    } else {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim() : ''
      const website = cleanWebsite(body.website)
      if (!name || name.length > 80) return fail('A name (under 80 chars) is required', 400)
      if (!EMAIL_RE.test(email) || email.length > 120) return fail('A valid email is required', 400)
      const { turnstileConfigured } = await getCommentEnv()
      if (comments.turnstile && turnstileConfigured) {
        if (!(await verifyTurnstile(turnstileToken, ip))) return fail('Verification failed — please try again', 400)
      }
      identity = { name, email, website, provider: 'manual' }
    }

    let created
    try {
      created = await addComment({ postSlug, parentId, ...identity, content, ip: ip === 'unknown' ? '' : ip, country })
    } catch (error) {
      // Bad input (missing parent, too-deep reply) → 400, not a 500.
      if (error instanceof CommentInputError) return fail(error.message, 400)
      throw error
    }
    after(() => logActivity('comment.create', postSlug))
    logRequest(req, 200, start)
    return ok({ comment: created })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to post comment', 500)
  }
}
