// Post data access. Stored in the Postgres `posts` table (metadata columns +
// the markdown body in `content`). Image refs (body + featuredImage) are kept
// store-relative (pathnames), re-expanded to absolute Blob URLs on read; the
// binaries themselves live on Vercel Blob.

import { cache } from 'react'
import type { Post, PostWithContent } from '@/types'
import { collapseBlob, expandBlob } from '@/lib/blob'
import { db } from '@/lib/db'
import { slugify, deriveExcerpt, clampExcerpt, isPublicallyVisible, readingMinutes } from '@/lib/utils'
import { ensureSlugFree } from '@/lib/slugs'
import { pushRevision, renameRevisions, deleteRevisions } from '@/lib/revisions'
import { getSettings } from '@/lib/settings'

// Metadata columns (everything except the heavy `content` body) for list reads.
const META_COLS = 'slug,title,date,status,categories,tags,featured_image,excerpt,reading_minutes'

// A row as stored in Postgres (snake_case, store-relative image refs).
type PostRow = {
  slug: string
  title: string
  date: string
  status: string
  categories: string[] | null
  tags: string[] | null
  featured_image: string | null
  excerpt: string | null
  reading_minutes: number | null
  content?: string | null
}

// Row -> Post metadata (absolute image URLs, no body).
function rowToMeta(row: PostRow): Post {
  return {
    title: row.title,
    slug: row.slug,
    date: row.date,
    status: row.status === 'published' ? 'published' : 'draft',
    categories: row.categories ?? [],
    tags: row.tags ?? [],
    featuredImage: row.featured_image ? expandBlob(row.featured_image) : undefined,
    excerpt: row.excerpt ?? undefined,
    readingMinutes: row.reading_minutes ?? undefined,
  }
}

// PostWithContent -> row (store-relative). Reading time is recomputed here so the
// column stays in sync with the body for list reads.
function toRow(post: PostWithContent): PostRow {
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    status: post.status,
    categories: post.categories,
    tags: post.tags,
    featured_image: post.featuredImage ? collapseBlob(post.featuredImage) : null,
    excerpt: post.excerpt ?? null,
    reading_minutes: readingMinutes(post.content),
    content: collapseBlob(post.content),
  }
}

// Stable store-relative projection of a post's meaningful fields — used to decide
// whether a save actually changed anything (so a no-op autosave skips a revision).
function projection(p: PostWithContent): string {
  return JSON.stringify({
    title: p.title,
    date: p.date,
    status: p.status,
    categories: p.categories,
    tags: p.tags,
    featuredImage: p.featuredImage ? collapseBlob(p.featuredImage) : '',
    excerpt: p.excerpt ?? '',
    content: collapseBlob(p.content),
  })
}

// Full metadata list, newest first. `React.cache` dedupes within one render only;
// every fresh request re-reads Postgres (always current, transactional — no
// read-after-write staleness, so no cache-busting dance needed).
const readIndex = cache(async (): Promise<Post[]> => {
  try {
    const { data, error } = await db()
      .from('posts')
      .select(META_COLS)
      .order('date', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] posts.readIndex: ${error.message}`)
      return []
    }
    return (data as PostRow[]).map(rowToMeta)
  } catch (error) {
    // Degrade to empty (e.g. missing env, DB unreachable) instead of 500ing.
    console.error(`[ERROR] posts.readIndex: ${(error as Error).message}`)
    return []
  }
})

// Full metadata manifest, newest first (admin list incl. drafts).
export async function getIndex(): Promise<Post[]> {
  return readIndex()
}

// Public-facing list: published + date reached only. Derives from the cached index.
export async function getPublicPosts(): Promise<Post[]> {
  const all = await readIndex()
  return all.filter((p) => isPublicallyVisible(p.status, p.date))
}

// Read one full post. `React.cache` dedupes the read across generateMetadata +
// the page render in ONE request; no cross-request cache, so content is current.
export const getPost = cache(async (slug: string): Promise<PostWithContent | null> => {
  try {
    const { data, error } = await db().from('posts').select('*').eq('slug', slug).maybeSingle()
    if (error || !data) return null
    const row = data as PostRow
    return { ...rowToMeta(row), content: expandBlob(row.content ?? '') }
  } catch (error) {
    console.error(`[ERROR] posts.getPost(${slug}): ${(error as Error).message}`)
    return null
  }
})

// Normalize incoming data into a complete Post + content pair. `excerptWords`
// (from settings) controls the auto-excerpt length when the author leaves it blank.
function normalize(input: Partial<PostWithContent>, excerptWords = 50): PostWithContent {
  const content = (input.content ?? '').trim()
  const title = (input.title ?? '').trim()
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(title)
  // Author excerpt wins (but is length-capped); otherwise auto from the body.
  const excerpt = input.excerpt?.trim() ? clampExcerpt(input.excerpt.trim()) : deriveExcerpt(content, excerptWords)
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

// Drop the body from a PostWithContent, adding the computed reading time so lists
// (which never load bodies) can show it.
function toMeta(post: PostWithContent): Post {
  const { content, ...meta } = post
  return { ...meta, readingMinutes: readingMinutes(content) }
}

// Create or overwrite a post.
export async function savePost(
  input: Partial<PostWithContent>,
  previousSlug?: string,
): Promise<Post> {
  const { excerptLength } = await getSettings()
  const post = normalize(input, excerptLength)
  // Reject a slug already taken by another post or page (shared URL namespace).
  await ensureSlugFree(post.slug, 'post', previousSlug)

  // Time machine: before overwriting an existing post, snapshot the current
  // version so the editor can restore it.
  const overwriting = previousSlug ?? post.slug
  const { data: existing } = await db().from('posts').select('*').eq('slug', overwriting).maybeSingle()
  if (existing) {
    const row = existing as PostRow
    const prev: PostWithContent = { ...rowToMeta(row), content: expandBlob(row.content ?? '') }
    if (projection(prev) !== projection({ ...post, slug: prev.slug })) {
      await pushRevision(prev)
    }
  }

  // Upsert by slug (PK). `updated_at` is bumped explicitly so it tracks edits.
  const { error } = await db()
    .from('posts')
    .upsert({ ...toRow(post), updated_at: new Date().toISOString() })
  if (error) throw new Error(`savePost: ${error.message}`)

  // If the slug changed, drop the old row and move its revisions.
  if (previousSlug && previousSlug !== post.slug) {
    await db().from('posts').delete().eq('slug', previousSlug)
    await renameRevisions(previousSlug, post.slug)
  }

  return toMeta(post) // full URLs for the client
}

// Delete a post and its revisions.
export async function deletePost(slug: string): Promise<void> {
  await db().from('posts').delete().eq('slug', slug)
  await deleteRevisions(slug)
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

export type TermKind = 'category' | 'tag'

// Apply a rename (newName set) or removal (newName null) to one term list,
// preserving order and de-duping (a rename that collides merges the two).
function applyTerm(list: string[], name: string, newName: string | null): string[] {
  if (!newName) return list.filter((x) => x !== name)
  const out: string[] = []
  for (const x of list) {
    const v = x === name ? newName : x
    if (!out.includes(v)) out.push(v)
  }
  return out
}

// Rename (newName set) or remove (newName null) a category/tag across EVERY post.
// Categories/tags are array columns, so only the affected rows' columns change —
// no body rewrite. Returns how many posts were changed.
export async function updateTerm(kind: TermKind, name: string, newName: string | null): Promise<number> {
  const field = kind === 'category' ? 'categories' : 'tags'
  const clean = newName?.trim() || null
  const { data, error } = await db().from('posts').select(`slug, ${field}`)
  if (error || !data) return 0
  let changed = 0
  await Promise.all(
    data.map(async (row) => {
      const list: string[] = (row as Record<string, string[]>)[field] ?? []
      if (!list.includes(name)) return
      changed++
      await db()
        .from('posts')
        .update({ [field]: applyTerm(list, name, clean) })
        .eq('slug', (row as { slug: string }).slug)
    }),
  )
  return changed
}

// Distinct categories across all posts.
export async function getCategories(): Promise<string[]> {
  const posts = await getIndex()
  return [...new Set(posts.flatMap((p) => p.categories))].sort()
}

// Distinct tags across all posts.
export async function getTags(): Promise<string[]> {
  const posts = await getIndex()
  return [...new Set(posts.flatMap((p) => p.tags))].sort()
}
