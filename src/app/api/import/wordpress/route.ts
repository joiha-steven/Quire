// POST /api/import/wordpress — import a WordPress export (.xml, WXR) into posts/pages
// (owner only). Content is converted to Markdown; images keep their source URLs. New
// content is ADDED — a slug that collides with existing content gets a numeric suffix,
// nothing is overwritten. Purges the cache once at the end.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { savePost } from '@/lib/posts'
import { savePage } from '@/lib/pages'
import { parseWxr } from '@/lib/wordpress-import'
import { SlugConflictError } from '@/lib/slugs'
import { revalidateEverything } from '@/lib/revalidate'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // a large export can take a while

const MAX_BYTES = 100 * 1024 * 1024 // 100MB — WXR is text; refuse absurd uploads

// Save with the given base slug, appending -2, -3… until it doesn't collide with
// existing content (posts + pages share one namespace). Returns the slug used.
async function saveUnique(base: string, save: (slug: string) => Promise<unknown>): Promise<string> {
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    try {
      await save(slug)
      return slug
    } catch (e) {
      if (e instanceof SlugConflictError) continue
      throw e
    }
  }
  throw new Error(`could not find a free slug for "${base}"`)
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      logRequest(req, 400, start)
      return fail('no_file', 400)
    }
    if (file.size > MAX_BYTES) {
      logRequest(req, 413, start)
      return fail('file_too_large', 413)
    }
    const xml = await file.text()
    if (!xml.includes('<rss') || !xml.includes('wp:post_type')) {
      logRequest(req, 400, start)
      return fail('not_a_wordpress_export', 400)
    }

    const { posts, pages, skipped } = parseWxr(xml, new Date().toISOString())

    let importedPosts = 0
    let importedPages = 0
    for (const p of posts) {
      const { slug, ...rest } = p
      await saveUnique(slug, (s) => savePost({ ...rest, slug: s }))
      importedPosts++
    }
    for (const pg of pages) {
      const { slug, ...rest } = pg
      await saveUnique(slug, (s) => savePage({ ...rest, slug: s }))
      importedPages++
    }

    if (importedPosts + importedPages > 0) revalidateEverything()
    after(() => logActivity('import.wordpress', `${importedPosts} posts + ${importedPages} pages`))
    logRequest(req, 200, start)
    return ok({ posts: importedPosts, pages: importedPages, skipped })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('import_failed', 500)
  }
}
