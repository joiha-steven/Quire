// MCP tool definitions: posts, pages and taxonomy. Each tool is a thin wrapper
// over the SAME data-layer functions the admin API routes use, so behaviour
// (slug rules, revisions, soft-delete to Trash, revalidation, activity log) is
// identical whether a human uses the admin UI or an agent uses MCP.
//
// Content is Markdown everywhere (the blog is 100% Markdown), so tools take/return
// the body verbatim — no conversion. Deletes go to Trash (soft delete), matching
// the rest of the app; permanent removal is owner-only via the Trash UI.

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PostWithContent, PageWithContent } from '@/types'
import { getIndex, getPost, savePost, deletePost, restorePost, getTrashedPosts, getCategories, getTags } from '@/lib/posts'
import { getPageIndex, getPage, savePage, deletePage, restorePage, getTrashedPages } from '@/lib/pages'
import { revalidateNewPost, revalidatePost, revalidatePage } from '@/lib/revalidate'
import { logActivity } from '@/lib/activity'
import { SlugConflictError } from '@/lib/slugs'
import { asText, asJson, asError } from '@/lib/mcp/result'
import { registerLibraryTools } from '@/lib/mcp/tools-library'

// Shared input shape for create/update of a post (all optional; savePost normalizes).
const postFields = {
  title: z.string().optional(),
  content: z.string().optional().describe('Markdown body of the post'),
  status: z.enum(['draft', 'published']).optional().describe("Defaults to 'draft'"),
  slug: z.string().optional().describe('URL slug; auto-derived from the title when omitted'),
  excerpt: z.string().optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  featuredImage: z.string().optional().describe('Image URL used only for SEO/social cards'),
  date: z.string().optional().describe('ISO 8601 publish date; defaults to now'),
}

const pageFields = {
  title: z.string().optional(),
  content: z.string().optional().describe('Markdown body of the page'),
  status: z.enum(['draft', 'published']).optional().describe("Defaults to 'draft'"),
  slug: z.string().optional(),
  featuredImage: z.string().optional(),
}

export function registerTools(server: McpServer): void {
  registerPostTools(server)
  registerPageTools(server)
  registerTaxonomyTools(server)
  registerLibraryTools(server)
}

function registerPostTools(server: McpServer): void {
  server.registerTool(
    'list_posts',
    { description: 'List all posts (drafts included) with metadata, newest first.', inputSchema: { status: z.enum(['draft', 'published']).optional() } },
    async ({ status }) => {
      const posts = await getIndex()
      const filtered = status ? posts.filter((p) => p.status === status) : posts
      return asJson(filtered.map((p) => ({ slug: p.slug, title: p.title, status: p.status, date: p.date, categories: p.categories, tags: p.tags })))
    },
  )

  server.registerTool(
    'get_post',
    { description: 'Get one post by slug, including its Markdown body.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      const post = await getPost(slug)
      return post ? asJson(post) : asError(`Post not found: ${slug}`)
    },
  )

  server.registerTool(
    'create_post',
    { description: 'Create a post. Returns the saved metadata. Status defaults to draft.', inputSchema: postFields },
    async (args) => {
      if (!args.title?.trim() && !args.slug?.trim()) return asError('Title or slug is required')
      try {
        const meta = await savePost(args as Partial<PostWithContent>)
        revalidateNewPost()
        await logActivity('post.create', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  server.registerTool(
    'update_post',
    { description: 'Overwrite an existing post by slug. This REPLACES the post, so pass the complete post (title, content, status, categories, tags…); omitted fields reset to defaults. Read it first with get_post if you only want to tweak. Returns the saved metadata.', inputSchema: { ...postFields, slug: z.string() } },
    async ({ slug, ...rest }) => {
      try {
        const meta = await savePost(rest as Partial<PostWithContent>, slug)
        revalidatePost(meta.slug, slug)
        await logActivity('post.update', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  server.registerTool(
    'delete_post',
    { description: 'Move a post to the Trash (soft delete — recoverable). Does not remove it permanently.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await deletePost(slug)
      revalidatePost(slug)
      await logActivity('post.delete', slug)
      return asText(`Moved post to Trash: ${slug}`)
    },
  )

  server.registerTool(
    'restore_post',
    { description: 'Restore a trashed post back to live.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await restorePost(slug)
      revalidatePost(slug)
      await logActivity('post.restore', slug)
      return asText(`Restored post: ${slug}`)
    },
  )

  server.registerTool(
    'list_trashed_posts',
    { description: 'List posts currently in the Trash.', inputSchema: {} },
    async () => asJson((await getTrashedPosts()).map((p) => ({ slug: p.slug, title: p.title, deletedAt: p.deletedAt }))),
  )
}

function registerPageTools(server: McpServer): void {
  server.registerTool(
    'list_pages',
    { description: 'List all static pages (drafts included).', inputSchema: {} },
    async () => asJson((await getPageIndex()).map((p) => ({ slug: p.slug, title: p.title, status: p.status }))),
  )

  server.registerTool(
    'get_page',
    { description: 'Get one page by slug, including its Markdown body.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      const page = await getPage(slug)
      return page ? asJson(page) : asError(`Page not found: ${slug}`)
    },
  )

  server.registerTool(
    'create_page',
    { description: 'Create a static page. Status defaults to draft.', inputSchema: pageFields },
    async (args) => {
      if (!args.title?.trim() && !args.slug?.trim()) return asError('Title or slug is required')
      try {
        const meta = await savePage(args as Partial<PageWithContent>)
        revalidatePage(meta.slug)
        await logActivity('page.create', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  server.registerTool(
    'update_page',
    { description: 'Update a page by slug (savePage overwrites — pass the full page).', inputSchema: { ...pageFields, slug: z.string() } },
    async ({ slug, ...rest }) => {
      try {
        const meta = await savePage(rest as Partial<PageWithContent>, slug)
        revalidatePage(meta.slug, slug)
        await logActivity('page.update', meta.title || meta.slug)
        return asJson(meta)
      } catch (e) {
        if (e instanceof SlugConflictError) return asError('slug_taken: that slug is already used by a post or page')
        throw e
      }
    },
  )

  server.registerTool(
    'delete_page',
    { description: 'Move a page to the Trash (soft delete — recoverable).', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await deletePage(slug)
      revalidatePage(slug)
      await logActivity('page.delete', slug)
      return asText(`Moved page to Trash: ${slug}`)
    },
  )

  server.registerTool(
    'restore_page',
    { description: 'Restore a trashed page back to live.', inputSchema: { slug: z.string() } },
    async ({ slug }) => {
      await restorePage(slug)
      revalidatePage(slug)
      await logActivity('page.restore', slug)
      return asText(`Restored page: ${slug}`)
    },
  )

  server.registerTool(
    'list_trashed_pages',
    { description: 'List pages currently in the Trash.', inputSchema: {} },
    async () => asJson((await getTrashedPages()).map((p) => ({ slug: p.slug, title: p.title, deletedAt: p.deletedAt }))),
  )
}

function registerTaxonomyTools(server: McpServer): void {
  server.registerTool(
    'list_categories',
    { description: 'List all distinct post categories.', inputSchema: {} },
    async () => asJson(await getCategories()),
  )
  server.registerTool(
    'list_tags',
    { description: 'List all distinct post tags.', inputSchema: {} },
    async () => asJson(await getTags()),
  )
}
