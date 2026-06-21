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
    const { data, error } = await db().from('pages').select(META_COLS)
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
    const { data, error } = await db().from('pages').select('*').eq('slug', slug).maybeSingle()
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

// Delete a page.
export async function deletePage(slug: string): Promise<void> {
  await db().from('pages').delete().eq('slug', slug)
}
