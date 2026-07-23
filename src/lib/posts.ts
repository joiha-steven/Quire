// Posts: metadata columns + markdown body in the Postgres `posts` table. Image
// refs (body + featuredImage) stored store-relative, re-expanded to absolute Blob
// URLs on read.

import { cache } from 'react'
import type { Post, PostWithContent } from '@/types'
import { collapseBlob, expandBlob } from '@/lib/blob'
import { db, liveOnly } from '@/lib/db'
import { slugify, deriveExcerpt, clampExcerpt, isPublicallyVisible, readingMinutes } from '@/lib/utils'
import { ensureSlugFree } from '@/lib/slugs'
import { pushRevision, renameRevisions, deleteRevisions } from '@/lib/revisions'
import { renameComments, deleteCommentsForPost } from '@/lib/comments'
import { saveRedirect, clearRedirectForPath } from '@/lib/redirects'
import { getSettings } from '@/lib/settings'

// Metadata columns (everything except the heavy `content` body) for list reads.
const META_COLS = 'slug,title,date,status,categories,tags,featured_image,excerpt,reading_minutes,series,series_order,meta_title,meta_description,cover_image,updated_at'

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
  series: string | null
  series_order: number | null
  meta_title: string | null
  meta_description: string | null
  cover_image: string | null
  updated_at?: string | null
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
    series: row.series ?? undefined,
    seriesOrder: row.series != null ? (row.series_order ?? 0) : undefined,
    metaTitle: row.meta_title ?? undefined,
    metaDescription: row.meta_description ?? undefined,
    coverImage: row.cover_image ? expandBlob(row.cover_image) : undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

// PostWithContent -> row (store-relative). Reading time recomputed so the column
// stays in sync with the body for list reads.
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
    series: post.series?.trim() || null,
    series_order: post.series?.trim() ? (post.seriesOrder ?? 0) : 0,
    meta_title: post.metaTitle?.trim() || null,
    meta_description: post.metaDescription?.trim() || null,
    cover_image: post.coverImage ? collapseBlob(post.coverImage) : null,
    content: collapseBlob(post.content),
  }
}

// Stable projection of meaningful fields — to decide whether a save changed
// anything (so a no-op autosave skips a revision).
function projection(p: PostWithContent): string {
  return JSON.stringify({
    title: p.title,
    date: p.date,
    status: p.status,
    categories: p.categories,
    tags: p.tags,
    series: p.series ?? '',
    seriesOrder: p.seriesOrder ?? 0,
    metaTitle: p.metaTitle ?? '',
    metaDescription: p.metaDescription ?? '',
    coverImage: p.coverImage ? collapseBlob(p.coverImage) : '',
    featuredImage: p.featuredImage ? collapseBlob(p.featuredImage) : '',
    excerpt: p.excerpt ?? '',
    content: collapseBlob(p.content),
  })
}

// Full metadata list, newest first. `React.cache` dedupes within one render; each
// request re-reads Postgres (always current, transactional).
const readIndex = cache(async (): Promise<Post[]> => {
  try {
    // liveOnly = `.is('deleted_at', null)` — trashed rows excluded everywhere but the Trash view.
    const { data, error } = await liveOnly(db().from('posts').select(META_COLS))
      .order('date', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] posts.readIndex: ${error.message}`)
      return []
    }
    return (data as PostRow[]).map(rowToMeta)
  } catch (error) {
    // Degrade to empty (missing env, DB unreachable) instead of 500ing.
    console.error(`[ERROR] posts.readIndex: ${(error as Error).message}`)
    return []
  }
})

// Full metadata manifest, newest first (admin list incl. drafts).
export async function getIndex(): Promise<Post[]> {
  return readIndex()
}

// Public list: published + date reached only.
export async function getPublicPosts(): Promise<Post[]> {
  const all = await readIndex()
  return all.filter((p) => isPublicallyVisible(p.status, p.date))
}

// FTS over title + BODY via the `search` tsvector (config 'simple': accent-
// sensitive, no stemming). Returns published + visible metadata, newest first.
export async function searchPosts(query: string): Promise<Post[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const { data, error } = await liveOnly(
      db()
        .from('posts')
        .select(META_COLS)
        .textSearch('search', q, { type: 'websearch', config: 'simple' })
        .eq('status', 'published'), // never surface trashed posts in search
    )
      .order('date', { ascending: false })
      .limit(50)
    if (error || !data) {
      if (error) console.error(`[ERROR] posts.searchPosts: ${error.message}`)
      return []
    }
    return (data as PostRow[]).map(rowToMeta).filter((p) => isPublicallyVisible(p.status, p.date))
  } catch (error) {
    console.error(`[ERROR] posts.searchPosts: ${(error as Error).message}`)
    return []
  }
}

// Read one full post. `React.cache` dedupes across generateMetadata + render in one request.
export const getPost = cache(async (slug: string): Promise<PostWithContent | null> => {
  try {
    const { data, error } = await liveOnly(db().from('posts').select('*').eq('slug', slug)).maybeSingle()
    if (error || !data) return null
    const row = data as PostRow
    return { ...rowToMeta(row), content: expandBlob(row.content ?? '') }
  } catch (error) {
    console.error(`[ERROR] posts.getPost(${slug}): ${(error as Error).message}`)
    return null
  }
})

// Normalize input into a complete Post + content pair. `excerptWords` sets the
// auto-excerpt length when the author leaves it blank.
function normalize(input: Partial<PostWithContent>, excerptWords = 50): PostWithContent {
  const content = (input.content ?? '').trim()
  const title = (input.title ?? '').trim()
  // slugify() can reduce a non-empty title/slug (emoji, punctuation-only, an empty
  // import title) to '' — an empty slug makes the row unreachable in the editor and
  // Trash. Fall back to a timestamped slug so every post keeps an editable identity.
  const slug = (input.slug?.trim() ? slugify(input.slug) : slugify(title)) || `post-${Date.now()}`
  // Author excerpt wins (length-capped); else auto from the body.
  const excerpt = input.excerpt?.trim() ? clampExcerpt(input.excerpt.trim()) : deriveExcerpt(content, excerptWords)
  return {
    title,
    slug,
    date: input.date ?? new Date().toISOString(),
    status: input.status === 'published' ? 'published' : 'draft',
    categories: input.categories ?? [],
    tags: input.tags ?? [],
    series: input.series?.trim() || undefined,
    seriesOrder: input.series?.trim() ? (input.seriesOrder ?? 0) : undefined,
    metaTitle: input.metaTitle?.trim() || undefined,
    metaDescription: input.metaDescription?.trim() || undefined,
    coverImage: input.coverImage || undefined,
    featuredImage: input.featuredImage || undefined,
    excerpt,
    content,
  }
}

// Drop the body, add computed reading time so lists (no bodies) can show it.
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
  // Slug shared across posts + pages → reject collisions.
  await ensureSlugFree(post.slug, 'post', previousSlug)

  // Time machine: snapshot the current version before overwriting.
  const overwriting = previousSlug ?? post.slug
  const { data: existing } = await db().from('posts').select('*').eq('slug', overwriting).maybeSingle()
  if (existing) {
    const row = existing as PostRow
    const prev: PostWithContent = { ...rowToMeta(row), content: expandBlob(row.content ?? '') }
    if (projection(prev) !== projection({ ...post, slug: prev.slug })) {
      await pushRevision(prev)
    }
  }

  // Upsert by slug (PK); bump `updated_at` to track edits.
  const { error } = await db()
    .from('posts')
    .upsert({ ...toRow(post), updated_at: new Date().toISOString() })
  if (error) throw new Error(`savePost: ${error.message}`)

  // Slug changed → drop the old row, move its revisions + comments, and leave a 301
  // from the old path so existing links + search results keep working.
  if (previousSlug && previousSlug !== post.slug) {
    await db().from('posts').delete().eq('slug', previousSlug)
    await renameRevisions(previousSlug, post.slug)
    await renameComments(previousSlug, post.slug)
    await saveRedirect({ source: `/${previousSlug}`, destination: `/${post.slug}`, permanent: true })
  }
  // This slug is now live content, so any redirect that used it as a SOURCE is stale
  // (live content must win over a redirect; also breaks a rename-back self-loop).
  await clearRedirectForPath(`/${post.slug}`)

  return toMeta(post)
}

// Soft-delete (set deleted_at): row/body/revisions/blobs kept, slug stays reserved
// so restore always works. Nothing purged until an explicit Trash purge.
export async function deletePost(slug: string): Promise<void> {
  await db().from('posts').update({ deleted_at: new Date().toISOString() }).eq('slug', slug)
}

// Restore to live (clear deleted_at); slug was reserved → no collision check.
export async function restorePost(slug: string): Promise<void> {
  await db().from('posts').update({ deleted_at: null }).eq('slug', slug)
}

// Hard delete a post + its revisions (Trash UI only).
export async function purgePost(slug: string): Promise<void> {
  await db().from('posts').delete().eq('slug', slug)
  await deleteRevisions(slug)
  await deleteCommentsForPost(slug)
}

// Trashed posts (metadata only), most-recently-deleted first, for the Trash view.
export async function getTrashedPosts(): Promise<Post[]> {
  try {
    const { data, error } = await db()
      .from('posts')
      .select(`${META_COLS},deleted_at`)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] posts.getTrashedPosts: ${error.message}`)
      return []
    }
    return (data as (PostRow & { deleted_at: string })[]).map((row) => ({
      ...rowToMeta(row),
      deletedAt: row.deleted_at,
    }))
  } catch (error) {
    console.error(`[ERROR] posts.getTrashedPosts: ${(error as Error).message}`)
    return []
  }
}

// Permanently remove EVERY trashed post (empty the posts Trash). Returns the count.
export async function emptyPostsTrash(): Promise<number> {
  const trashed = await getTrashedPosts()
  await Promise.all(trashed.map((p) => purgePost(p.slug)))
  return trashed.length
}

// Up to `limit` other public posts sharing the most tags/categories (tags weighted
// ×2), newest first as tiebreak. Empty when nothing shares.
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

// Rename (newName set) or remove (null) a category/tag across EVERY post. Array
// columns → only affected rows change, no body rewrite. Returns posts changed.
// ACCEPTED RISK — the one read-modify-write in the data layer: it reads each row's
// array, edits it in JS, and writes the whole array back. A concurrent write to the
// SAME post (another updateTerm, or a savePost) would last-write-win and drop the
// other's array edit. Safe here because Quire is single-owner (one admin, no MCP/cron
// path writes post arrays), so simultaneous same-post writes don't occur. A single
// SQL `array_replace`/`array_remove` RPC would close it if that ever changes.
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

export type TermCount = { name: string; count: number }

// Terms of PUBLISHED posts only, with their post counts — what the public sidebar
// lists. Busiest first, ties alphabetical. (`getCategories`/`getTags` above serve
// the admin, and include drafts.)
export async function getPublicTaxonomy(): Promise<{ categories: TermCount[]; tags: TermCount[] }> {
  const posts = await getPublicPosts()
  const tally = (pick: (p: Post) => string[]): TermCount[] => {
    const counts = new Map<string, number>()
    for (const p of posts) for (const term of pick(p)) counts.set(term, (counts.get(term) ?? 0) + 1)
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }
  return { categories: tally((p) => p.categories), tags: tally((p) => p.tags) }
}
