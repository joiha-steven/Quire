// Post data access. _index.json (metadata only) is the single query layer;
// full content lives in posts/{slug}.md as YAML frontmatter + markdown body.

import { cache } from 'react'
import matter from 'gray-matter'
import type { Post, PostWithContent } from '@/types'
import { readJson, writeJson, readText, writeText, deleteByPathname, collapseBlob, expandBlob } from '@/lib/blob'
import { slugify, deriveExcerpt, clampExcerpt, isPublicallyVisible, readingMinutes } from '@/lib/utils'
import { ensureSlugFree } from '@/lib/slugs'
import { pushRevision, renameRevisions, deleteRevisions } from '@/lib/revisions'
import { getSettings } from '@/lib/settings'

const INDEX_PATH = 'posts/_index.json'
const mdPath = (slug: string) => `posts/${slug}.md`

// Raw manifest read. NO cross-request cache (that was the source of repeated
// stale-content bugs vs Blob's read-after-write). `React.cache` only dedupes
// within a single render pass; every fresh request re-reads Blob (cache-busted),
// so an edit is visible on the next load with no revalidation dance.
const readIndex = cache(async (): Promise<Post[]> => {
  await getSettings() // prime the vanity media base (setMediaBase) before expandBlob
  const posts = await readJson<Post[]>(INDEX_PATH, [])
  return [...posts]
    .map((p) => ({ ...p, featuredImage: p.featuredImage ? expandBlob(p.featuredImage) : undefined }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

// Full metadata manifest, newest first (admin list incl. drafts). Tag 'posts'.
export async function getIndex(): Promise<Post[]> {
  return readIndex()
}

// Public-facing list: published + date reached only. Derives from the cached index.
export async function getPublicPosts(): Promise<Post[]> {
  const all = await readIndex()
  return all.filter((p) => isPublicallyVisible(p.status, p.date))
}

// Parse a post's frontmatter + markdown body into a PostWithContent.
function parsePost(raw: string, slug: string): PostWithContent {
  const { data, content } = matter(raw)
  const meta = data as Partial<Post>
  return {
    title: meta.title ?? slug,
    slug: meta.slug ?? slug,
    date: meta.date ?? new Date().toISOString(),
    status: meta.status === 'published' ? 'published' : 'draft',
    categories: meta.categories ?? [],
    tags: meta.tags ?? [],
    featuredImage: meta.featuredImage ? expandBlob(meta.featuredImage) : undefined,
    excerpt: meta.excerpt,
    content: expandBlob(content.trim()),
  }
}

// Read+parse one post's markdown. `React.cache` dedupes the read across
// generateMetadata + the page render in ONE request; no cross-request cache, so
// the content is always current.
export const getPost = cache(async (slug: string): Promise<PostWithContent | null> => {
  await getSettings() // prime the vanity media base (setMediaBase) before expandBlob
  const raw = await readText(mdPath(slug))
  if (!raw) return null
  return parsePost(raw, slug)
})

// Normalize incoming data into a complete Post + content pair.
function normalize(input: Partial<PostWithContent>): PostWithContent {
  const content = (input.content ?? '').trim()
  const title = (input.title ?? '').trim()
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(title)
  // Author excerpt wins (but is length-capped); otherwise auto from the body.
  const excerpt = input.excerpt?.trim() ? clampExcerpt(input.excerpt.trim()) : deriveExcerpt(content)
  return {
    title,
    slug,
    date: input.date ?? new Date().toISOString(),
    status: input.status === 'published' ? 'published' : 'draft',
    categories: input.categories ?? [],
    tags: input.tags ?? [],
    featuredImage: input.featuredImage || undefined,
    excerpt,
    content,
  }
}

// Split a PostWithContent into its index metadata (no body). Reading time is
// computed from the body here so lists (which read only the index) can show it.
function toMeta(post: PostWithContent): Post {
  const { content, ...meta } = post
  return { ...meta, readingMinutes: readingMinutes(content) }
}

// Store-relative copy of a post's metadata (Blob URLs -> pathnames).
function collapseMeta(meta: Post): Post {
  return { ...meta, featuredImage: meta.featuredImage ? collapseBlob(meta.featuredImage) : undefined }
}

// Serialize a post to frontmatter + markdown, storing Blob refs as pathnames.
// Strip undefined fields first — js-yaml throws on undefined values.
function serialize(post: PostWithContent): string {
  const meta = collapseMeta(toMeta(post))
  const clean = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined),
  )
  return matter.stringify(collapseBlob(post.content), clean)
}

// Read index, apply an update in memory, write it back. Never partial-write.
async function mutateIndex(fn: (posts: Post[]) => Post[]): Promise<void> {
  const current = await readJson<Post[]>(INDEX_PATH, [])
  await writeJson(INDEX_PATH, fn(current))
}

// Create or overwrite a post: write {slug}.md, then sync the manifest.
export async function savePost(
  input: Partial<PostWithContent>,
  previousSlug?: string,
): Promise<Post> {
  const post = normalize(input)
  // Reject a slug already taken by another post or page (shared URL namespace).
  await ensureSlugFree(post.slug, 'post', previousSlug)

  // Time machine: before overwriting an existing post, snapshot the current
  // version so the editor can restore it. Read fresh (not the cached getPost).
  const overwriting = previousSlug ?? post.slug
  const existingRaw = await readText(mdPath(overwriting))
  if (existingRaw) {
    const prev = parsePost(existingRaw, overwriting)
    if (serialize(prev) !== serialize({ ...post, slug: prev.slug })) {
      await pushRevision(prev)
    }
  }

  await writeText(mdPath(post.slug), serialize(post))

  // If the slug changed, drop the old markdown file and move its revisions.
  if (previousSlug && previousSlug !== post.slug) {
    await deleteByPathname(mdPath(previousSlug))
    await renameRevisions(previousSlug, post.slug)
  }

  const meta = toMeta(post)
  await mutateIndex((posts) => {
    const without = posts.filter((p) => p.slug !== post.slug && p.slug !== previousSlug)
    return [...without, collapseMeta(meta)] // store pathname; reads re-expand
  })
  return meta // full URLs for the client
}

// Delete a post: remove {slug}.md and its manifest entry.
export async function deletePost(slug: string): Promise<void> {
  await deleteByPathname(mdPath(slug))
  await deleteRevisions(slug)
  await mutateIndex((posts) => posts.filter((p) => p.slug !== slug))
}

// Up to `limit` other public posts sharing the most tags/categories with `slug`
// (tags weighted higher), newest first as a tiebreak. Empty when nothing shares.
export async function getRelatedPosts(slug: string, limit = 3): Promise<Post[]> {
  const all = await getPublicPosts()
  const current = all.find((p) => p.slug === slug)
  if (!current) return []
  const tags = new Set(current.tags)
  const cats = new Set(current.categories)
  return all
    .filter((p) => p.slug !== slug)
    .map((p) => ({
      p,
      score: p.tags.filter((t) => tags.has(t)).length * 2 + p.categories.filter((c) => cats.has(c)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.p.date).getTime() - new Date(a.p.date).getTime())
    .slice(0, limit)
    .map((x) => x.p)
}

// Distinct categories across the manifest.
export async function getCategories(): Promise<string[]> {
  const posts = await getIndex()
  return [...new Set(posts.flatMap((p) => p.categories))].sort()
}

// Distinct tags across the manifest.
export async function getTags(): Promise<string[]> {
  const posts = await getIndex()
  return [...new Set(posts.flatMap((p) => p.tags))].sort()
}
