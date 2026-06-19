// Static page data access. Mirrors posts.ts but with no taxonomy or date.
// _index.json holds metadata only; full content lives in pages/{slug}.md.

import matter from 'gray-matter'
import type { Page, PageWithContent } from '@/types'
import { readJson, writeJson, readText, writeText, deleteByPathname } from '@/lib/blob'
import { slugify } from '@/lib/utils'
import { ensureSlugFree } from '@/lib/slugs'

const INDEX_PATH = 'pages/_index.json'
const mdPath = (slug: string) => `pages/${slug}.md`

// Read the metadata manifest, ordered by title for a stable list.
export async function getPageIndex(): Promise<Page[]> {
  const pages = await readJson<Page[]>(INDEX_PATH, [])
  return [...pages].sort((a, b) => a.title.localeCompare(b.title))
}

// Public-facing list: published only (pages have no date gate).
export async function getPublicPages(): Promise<Page[]> {
  const all = await getPageIndex()
  return all.filter((p) => p.status === 'published')
}

// Read a single page with its markdown body, or null when missing.
export async function getPage(slug: string): Promise<PageWithContent | null> {
  const raw = await readText(mdPath(slug))
  if (!raw) return null
  const { data, content } = matter(raw)
  const meta = data as Partial<Page>
  return {
    title: meta.title ?? slug,
    slug: meta.slug ?? slug,
    status: meta.status === 'published' ? 'published' : 'draft',
    featuredImage: meta.featuredImage,
    imageDisplay: meta.imageDisplay ?? 'post',
    content: content.trim(),
  }
}

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
    imageDisplay: input.imageDisplay ?? 'post',
    content,
  }
}

// Split a PageWithContent into its index metadata (no body).
function toMeta(page: PageWithContent): Page {
  const { content: _content, ...meta } = page
  void _content
  return meta
}

// Serialize a page to frontmatter + markdown.
// Strip undefined fields first — js-yaml throws on undefined values.
function serialize(page: PageWithContent): string {
  const meta = toMeta(page)
  const clean = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined),
  )
  return matter.stringify(page.content, clean)
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
    return [...without, meta]
  })
  return meta
}

// Delete a page: remove {slug}.md and its manifest entry.
export async function deletePage(slug: string): Promise<void> {
  await deleteByPathname(mdPath(slug))
  await mutateIndex((pages) => pages.filter((p) => p.slug !== slug))
}
