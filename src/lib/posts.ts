// Post data access. _index.json (metadata only) is the single query layer;
// full content lives in posts/{slug}.md as YAML frontmatter + markdown body.

import matter from 'gray-matter'
import type { Post, PostWithContent } from '@/types'
import { readJson, writeJson, readText, writeText, deleteByPathname } from '@/lib/blob'
import { slugify, deriveExcerpt, isPublicallyVisible } from '@/lib/utils'

const INDEX_PATH = 'posts/_index.json'
const mdPath = (slug: string) => `posts/${slug}.md`

// Read the full metadata manifest, newest first.
export async function getIndex(): Promise<Post[]> {
  const posts = await readJson<Post[]>(INDEX_PATH, [])
  return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Public-facing list: published + date reached only.
export async function getPublicPosts(): Promise<Post[]> {
  const all = await getIndex()
  return all.filter((p) => isPublicallyVisible(p.status, p.date))
}

// Read a single post with its markdown body, or null when missing.
export async function getPost(slug: string): Promise<PostWithContent | null> {
  const raw = await readText(mdPath(slug))
  if (!raw) return null
  const { data, content } = matter(raw)
  const meta = data as Partial<Post>
  return {
    title: meta.title ?? slug,
    slug: meta.slug ?? slug,
    date: meta.date ?? new Date().toISOString(),
    status: meta.status === 'published' ? 'published' : 'draft',
    categories: meta.categories ?? [],
    tags: meta.tags ?? [],
    featuredImage: meta.featuredImage,
    imageDisplay: meta.imageDisplay ?? 'post',
    excerpt: meta.excerpt,
    content: content.trim(),
  }
}

// Normalize incoming data into a complete Post + content pair.
function normalize(input: Partial<PostWithContent>): PostWithContent {
  const content = (input.content ?? '').trim()
  const title = (input.title ?? '').trim()
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(title)
  const excerpt = input.excerpt?.trim() ? input.excerpt.trim() : deriveExcerpt(content)
  return {
    title,
    slug,
    date: input.date ?? new Date().toISOString(),
    status: input.status === 'published' ? 'published' : 'draft',
    categories: input.categories ?? [],
    tags: input.tags ?? [],
    featuredImage: input.featuredImage || undefined,
    imageDisplay: input.imageDisplay ?? 'post',
    excerpt,
    content,
  }
}

// Split a PostWithContent into its index metadata (no body).
function toMeta(post: PostWithContent): Post {
  const { content: _content, ...meta } = post
  void _content
  return meta
}

// Serialize a post to frontmatter + markdown.
// Strip undefined fields first — js-yaml throws on undefined values.
function serialize(post: PostWithContent): string {
  const meta = toMeta(post)
  const clean = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined),
  )
  return matter.stringify(post.content, clean)
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
  await writeText(mdPath(post.slug), serialize(post))

  // If the slug changed, drop the old markdown file.
  if (previousSlug && previousSlug !== post.slug) {
    await deleteByPathname(mdPath(previousSlug))
  }

  const meta = toMeta(post)
  await mutateIndex((posts) => {
    const without = posts.filter((p) => p.slug !== post.slug && p.slug !== previousSlug)
    return [...without, meta]
  })
  return meta
}

// Delete a post: remove {slug}.md and its manifest entry.
export async function deletePost(slug: string): Promise<void> {
  await deleteByPathname(mdPath(slug))
  await mutateIndex((posts) => posts.filter((p) => p.slug !== slug))
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
