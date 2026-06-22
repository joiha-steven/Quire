// Static page data access. Mirrors posts.ts but with no taxonomy or date.
// Stored in the Postgres `pages` table (metadata + markdown body in `content`).

import { cache } from 'react'
import type { Page, PageWithContent } from '@/types'
import { collapseBlob, expandBlob } from '@/lib/blob'
import { db } from '@/lib/db'
import { slugify } from '@/lib/utils'
import { ensureSlugFree } from '@/lib/slugs'

const META_COLS = 'slug,title,status,featured_image'

type PageRow = {
  slug: string
  title: string
  status: string
  featured_image: string | null
  content?: string | null
}

function rowToMeta(row: PageRow): Page {
  return {
    title: row.title,
    slug: row.slug,
    status: row.status === 'published' ? 'published' : 'draft',
    featuredImage: row.featured_image ? expandBlob(row.featured_image) : undefined,
  }
}

// Metadata list, ordered by title (admin list incl. drafts). `React.cache`
// dedupes within one render; every request re-reads Postgres (always current).
const readIndex = cache(async (): Promise<Page[]> => {
  try {
    const { data, error } = await db().from('pages').select(META_COLS).is('deleted_at', null)
    if (error || !data) {
      if (error) console.error(`[ERROR] pages.readIndex: ${error.message}`)
      return []
    }
    return (data as PageRow[]).map(rowToMeta).sort((a, b) => a.title.localeCompare(b.title))
  } catch (error) {
    console.error(`[ERROR] pages.readIndex: ${(error as Error).message}`)
    return []
  }
})

// Metadata manifest, ordered by title (admin list incl. drafts).
export async function getPageIndex(): Promise<Page[]> {
  return readIndex()
}

// Public-facing list: published only (pages have no date gate).
export async function getPublicPages(): Promise<Page[]> {
  const all = await readIndex()
  return all.filter((p) => p.status === 'published')
}

// Read one full page. `React.cache` dedupes within one request only.
export const getPage = cache(async (slug: string): Promise<PageWithContent | null> => {
  try {
    const { data, error } = await db().from('pages').select('*').eq('slug', slug).is('deleted_at', null).maybeSingle()
    if (error || !data) return null
    const row = data as PageRow
    return { ...rowToMeta(row), content: expandBlob(row.content ?? '') }
  } catch (error) {
    console.error(`[ERROR] pages.getPage(${slug}): ${(error as Error).message}`)
    return null
  }
})

// Normalize incoming data into a complete Page + content pair.
function normalize(input: Partial<PageWithContent>): PageWithContent {
  const content = (input.content ?? '').trim()
  const title = (input.title ?? '').trim()
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(title)
  return {
    title,
    slug,
    status: input.status === 'published' ? 'published' : 'draft',
    featuredImage: input.featuredImage || undefined,
    content,
  }
}

function toMeta(page: PageWithContent): Page {
  const { content: _content, ...meta } = page
  void _content
  return meta
}

// PageWithContent -> row (store-relative image refs).
function toRow(page: PageWithContent): PageRow {
  return {
    slug: page.slug,
    title: page.title,
    status: page.status,
    featured_image: page.featuredImage ? collapseBlob(page.featuredImage) : null,
    content: collapseBlob(page.content),
  }
}

// Create or overwrite a page.
export async function savePage(
  input: Partial<PageWithContent>,
  previousSlug?: string,
): Promise<Page> {
  const page = normalize(input)
  // Reject a slug already taken by another page or post (shared URL namespace).
  await ensureSlugFree(page.slug, 'page', previousSlug)

  const { error } = await db()
    .from('pages')
    .upsert({ ...toRow(page), updated_at: new Date().toISOString() })
  if (error) throw new Error(`savePage: ${error.message}`)

  // If the slug changed, drop the old row.
  if (previousSlug && previousSlug !== page.slug) {
    await db().from('pages').delete().eq('slug', previousSlug)
  }

  return toMeta(page) // full URLs for the client
}

// Soft-delete a page: move it to the Trash (set deleted_at). The row, body and any
// referenced blobs are kept; nothing is purged until an explicit Trash purge. The
// slug stays reserved (the row still exists) so restore always works.
export async function deletePage(slug: string): Promise<void> {
  await db().from('pages').update({ deleted_at: new Date().toISOString() }).eq('slug', slug)
}

// Restore a trashed page back to live (clear deleted_at).
export async function restorePage(slug: string): Promise<void> {
  await db().from('pages').update({ deleted_at: null }).eq('slug', slug)
}

// Permanently remove a page (hard delete, irreversible). Only reached from Trash.
export async function purgePage(slug: string): Promise<void> {
  await db().from('pages').delete().eq('slug', slug)
}

// Trashed pages (metadata only), most-recently-deleted first, for the Trash view.
export async function getTrashedPages(): Promise<Page[]> {
  try {
    const { data, error } = await db()
      .from('pages')
      .select(`${META_COLS},deleted_at`)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] pages.getTrashedPages: ${error.message}`)
      return []
    }
    return (data as (PageRow & { deleted_at: string })[]).map((row) => ({
      ...rowToMeta(row),
      deletedAt: row.deleted_at,
    }))
  } catch (error) {
    console.error(`[ERROR] pages.getTrashedPages: ${(error as Error).message}`)
    return []
  }
}

// Permanently remove EVERY trashed page (empty the pages Trash). Returns the count.
export async function emptyPagesTrash(): Promise<number> {
  const trashed = await getTrashedPages()
  await Promise.all(trashed.map((p) => purgePage(p.slug)))
  return trashed.length
}
