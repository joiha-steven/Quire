// Static page data access. Mirrors posts.ts but with no taxonomy or date.
// _index.json holds metadata only; full content lives in pages/{slug}.md.

import { cache } from 'react'
import matter from 'gray-matter'
import type { Page, PageWithContent } from '@/types'
import { readJson, writeJson, readText, writeText, deleteByPathname, collapseBlob, expandBlob } from '@/lib/blob'
import { slugify } from '@/lib/utils'
import { ensureSlugFree } from '@/lib/slugs'
import { getSettings } from '@/lib/settings'

const INDEX_PATH = 'pages/_index.json'
const mdPath = (slug: string) => `pages/${slug}.md`

// Raw manifest read. No cross-request cache (see posts.ts) — `React.cache` only
// dedupes within one render; every request re-reads Blob, so edits show at once.
const readIndex = cache(async (): Promise<Page[]> => {
  await getSettings() // prime the vanity media base (setMediaBase) before expandBlob
  const pages = await readJson<Page[]>(INDEX_PATH, [])
  return [...pages]
    .map((p) => ({ ...p, featuredImage: p.featuredImage ? expandBlob(p.featuredImage) : undefined }))
    .sort((a, b) => a.title.localeCompare(b.title))
})

// Metadata manifest, ordered by title (admin list incl. drafts). Tag 'pages'.
export async function getPageIndex(): Promise<Page[]> {
  return readIndex()
}

// Public-facing list: published only (pages have no date gate).
export async function getPublicPages(): Promise<Page[]> {
  const all = await readIndex()
  return all.filter((p) => p.status === 'published')
}

// Read+parse one page's markdown. `React.cache` dedupes within one request only.
export const getPage = cache(async (slug: string): Promise<PageWithContent | null> => {
  await getSettings() // prime the vanity media base (setMediaBase) before expandBlob
  const raw = await readText(mdPath(slug))
  if (!raw) return null
  const { data, content } = matter(raw)
  const meta = data as Partial<Page>
  return {
    title: meta.title ?? slug,
    slug: meta.slug ?? slug,
    status: meta.status === 'published' ? 'published' : 'draft',
    featuredImage: meta.featuredImage ? expandBlob(meta.featuredImage) : undefined,
    content: expandBlob(content.trim()),
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

// Split a PageWithContent into its index metadata (no body).
function toMeta(page: PageWithContent): Page {
  const { content: _content, ...meta } = page
  void _content
  return meta
}

// Store-relative copy of a page's metadata (Blob URLs -> pathnames).
function collapseMeta(meta: Page): Page {
  return { ...meta, featuredImage: meta.featuredImage ? collapseBlob(meta.featuredImage) : undefined }
}

// Serialize a page to frontmatter + markdown, storing Blob refs as pathnames.
// Strip undefined fields first — js-yaml throws on undefined values.
function serialize(page: PageWithContent): string {
  const meta = collapseMeta(toMeta(page))
  const clean = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined),
  )
  return matter.stringify(collapseBlob(page.content), clean)
}

// Read index, apply an update in memory, write it back. Never partial-write.
async function mutateIndex(fn: (pages: Page[]) => Page[]): Promise<void> {
  const current = await readJson<Page[]>(INDEX_PATH, [])
  await writeJson(INDEX_PATH, fn(current))
}

// Create or overwrite a page: write {slug}.md, then sync the manifest.
export async function savePage(
  input: Partial<PageWithContent>,
  previousSlug?: string,
): Promise<Page> {
  const page = normalize(input)
  // Reject a slug already taken by another page or post (shared URL namespace).
  await ensureSlugFree(page.slug, 'page', previousSlug)
  await writeText(mdPath(page.slug), serialize(page))

  // If the slug changed, drop the old markdown file.
  if (previousSlug && previousSlug !== page.slug) {
    await deleteByPathname(mdPath(previousSlug))
  }

  const meta = toMeta(page)
  await mutateIndex((pages) => {
    const without = pages.filter((p) => p.slug !== page.slug && p.slug !== previousSlug)
    return [...without, collapseMeta(meta)] // store pathname; reads re-expand
  })
  return meta // full URLs for the client
}

// Delete a page: remove {slug}.md and its manifest entry.
export async function deletePage(slug: string): Promise<void> {
  await deleteByPathname(mdPath(slug))
  await mutateIndex((pages) => pages.filter((p) => p.slug !== slug))
}
