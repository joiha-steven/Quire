// Posts and pages: the admin's CRUD.
//
// Ported from `src/app/api/{posts,pages}`, and shorter than what it replaces for three
// structural reasons rather than any cleverness:
//
//   * `requireOwner()` is gone from every handler. The router these mount on carries it
//     (Invariant 4), so the three-line preamble each of the six handlers repeated is now
//     a property of where the route lives.
//   * `logRequest` / `logError` are gone. `requestLogger()` times and logs every request
//     because it went through the router, not because a handler remembered to.
//   * `revalidatePost(meta.slug, slug)` becomes `clearCache()`. Invariant 1: one Map, and
//     every write empties all of it. The frozen tree computed a per-write superset of
//     affected paths and needed a test to stop it under-purging.
//
// What is NOT simplified: the status codes, the 409 on a slug conflict, the shape of every
// response body, and the order of operations. Those are the contract the admin client
// depends on.

import type { Context } from 'hono'
import type { PageWithContent, PostWithContent } from '@/types'
import { getIndex, getPost, savePost, deletePost } from '@/content/posts'
import { getPageIndex, getPage, savePage, deletePage } from '@/content/pages'
import { getRevisions } from '@/content/revisions'
import { SlugConflictError } from '@/content/slugs'
import { finalizeContentMedia } from '@/media/finalize'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter, param } from '@/web/guard'

/**
 * Generate display variants after the response has been sent.
 *
 * The frozen tree used Next's `after()`. There is no equivalent here and none is needed:
 * the promise is simply not awaited, and the runtime keeps running. The rules are the same
 * as they were — the original image always renders meanwhile, and the cron sweep finalises
 * anything this drops — so a failure here costs a slower first paint, never a save.
 *
 * `clearCache()` runs again on success because the page was cached with a plain `<img>`
 * while the variants did not yet exist.
 */
function finalizeAfterResponse(content: string, featuredImage?: string): void {
  void finalizeContentMedia(content, featuredImage)
    .then((finalized) => {
      if (finalized > 0) clearCache()
    })
    .catch((error: unknown) => {
      console.error(`[ERROR] finalizeContentMedia: ${(error as Error).message}`)
    })
}

/** A JSON body, or `{}` when it is absent or malformed. */
const body = async <T>(c: Context): Promise<Partial<T>> =>
  (await c.req.json().catch(() => ({}))) as Partial<T>

export function contentRoutes() {
  const router = ownerRouter()

  // ----- posts ----------------------------------------------------------------

  // Owner only, and that is the whole reason this route exists: it returns EVERY post
  // including drafts. The public pages read the data layer server-side and never come here.
  router.get('/api/posts', async () => json(await getIndex()))

  router.post('/api/posts', async (c) => {
    const input = await body<PostWithContent>(c)
    if (!input.title?.trim() && !input.slug?.trim()) return fail(c, 'Title or slug is required', 400)
    try {
      const meta = await savePost(input)
      finalizeAfterResponse(input.content ?? '', input.featuredImage ?? undefined)
      clearCache()
      void logActivity('post.create', meta.title || meta.slug)
      return json(meta, 201)
    } catch (error) {
      // `slug_taken` verbatim: the admin client matches on this string, not on the status.
      if (error instanceof SlugConflictError) return fail(c, 'slug_taken', 409)
      throw error
    }
  })

  router.get('/api/posts/:slug', async (c) => {
    const post = await getPost(param(c, 'slug'))
    return post === null ? fail(c, 'Post not found', 404) : json(post)
  })

  router.put('/api/posts/:slug', async (c) => {
    const slug = param(c, 'slug')
    const input = await body<PostWithContent>(c)
    try {
      const meta = await savePost(input, slug)
      finalizeAfterResponse(input.content ?? '', input.featuredImage ?? undefined)
      clearCache()
      void logActivity('post.update', meta.title || meta.slug)
      return json(meta)
    } catch (error) {
      if (error instanceof SlugConflictError) return fail(c, 'slug_taken', 409)
      throw error
    }
  })

  router.delete('/api/posts/:slug', async (c) => {
    const slug = param(c, 'slug')
    await deletePost(slug)
    clearCache()
    void logActivity('post.delete', slug)
    return json({ slug })
  })

  router.get('/api/posts/:slug/revisions', async (c) => json(await getRevisions(param(c, 'slug'))))

  // ----- pages ----------------------------------------------------------------
  // Deliberately NOT folded into a shared factory with posts above. They differ in their
  // activity actions, their save signatures and their revision support, and a factory
  // parameterised over those differences would be longer than both and harder to read
  // than either.

  router.get('/api/pages', async () => json(await getPageIndex()))

  router.post('/api/pages', async (c) => {
    const input = await body<PageWithContent>(c)
    if (!input.title?.trim() && !input.slug?.trim()) return fail(c, 'Title or slug is required', 400)
    try {
      const meta = await savePage(input)
      finalizeAfterResponse(input.content ?? '')
      clearCache()
      void logActivity('page.create', meta.title || meta.slug)
      return json(meta, 201)
    } catch (error) {
      if (error instanceof SlugConflictError) return fail(c, 'slug_taken', 409)
      throw error
    }
  })

  router.get('/api/pages/:slug', async (c) => {
    const page = await getPage(param(c, 'slug'))
    return page === null ? fail(c, 'Page not found', 404) : json(page)
  })

  router.put('/api/pages/:slug', async (c) => {
    const slug = param(c, 'slug')
    const input = await body<PageWithContent>(c)
    try {
      const meta = await savePage(input, slug)
      finalizeAfterResponse(input.content ?? '')
      clearCache()
      void logActivity('page.update', meta.title || meta.slug)
      return json(meta)
    } catch (error) {
      if (error instanceof SlugConflictError) return fail(c, 'slug_taken', 409)
      throw error
    }
  })

  router.delete('/api/pages/:slug', async (c) => {
    const slug = param(c, 'slug')
    await deletePage(slug)
    clearCache()
    void logActivity('page.delete', slug)
    return json({ slug })
  })

  return router
}
