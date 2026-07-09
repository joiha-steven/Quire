// Parse a WordPress export (WXR .xml) into Quire posts + pages. PURE — no I/O; the
// API route (api/import/wordpress) persists the result via savePost/savePage. Each
// post's HTML body is converted to Markdown (turndown + GFM), and categories, tags,
// dates, status and excerpt are preserved. Image URLs are kept as-is (they point at
// the source site) — the importer does not download/rehost binaries.

import { XMLParser } from 'fast-xml-parser'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { slugify, deriveExcerpt } from '@/lib/utils'

export type ImportedPost = {
  title: string
  slug: string
  date: string
  status: 'draft' | 'published'
  categories: string[]
  tags: string[]
  excerpt: string
  content: string
}
export type ImportedPage = { title: string; slug: string; status: 'draft' | 'published'; content: string }
export type WxrResult = { posts: ImportedPost[]; pages: ImportedPage[]; skipped: number }

// A single figure/img subtree, narrowed from turndown's DOM node (no `any`).
type FigureEl = {
  querySelector(sel: string): { getAttribute(name: string): string | null; textContent: string | null } | null
}

function makeTurndown(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
  td.use(gfm)
  // WordPress wraps captioned images in <figure><img><figcaption>…</figcaption>.
  // Quire renders a figure caption from the image alt, so fold the caption INTO the
  // alt rather than leaving a separate italic paragraph under the image.
  td.addRule('figureCaption', {
    filter: 'figure',
    replacement: (content, node) => {
      const el = node as unknown as FigureEl
      const img = el.querySelector('img')
      const src = img?.getAttribute('src') ?? ''
      if (!src) return content
      const cap = el.querySelector('figcaption')?.textContent ?? img?.getAttribute('alt') ?? ''
      const alt = cap.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()
      return `\n\n![${alt}](${src})\n\n`
    },
  })
  return td
}

// ---- WXR field helpers (the parser yields untyped nodes) --------------------

function asArray(v: unknown): unknown[] {
  return v == null ? [] : Array.isArray(v) ? v : [v]
}
function raw(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    const t = (v as Record<string, unknown>)['#text']
    return t == null ? '' : String(t)
  }
  return String(v)
}

// Decode HTML entities WordPress leaves in plain-text fields (titles/excerpts),
// including double-encoded ones (&amp;amp; → &). Two passes.
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
}
function decodeEntities(s: string): string {
  let out = s
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)))
      .replace(/&([a-z]+);/gi, (m, name: string) => NAMED[name.toLowerCase()] ?? m)
  }
  return out
}
const text = (v: unknown): string => decodeEntities(raw(v))

function toIso(wpDate: unknown, fallback: string): string {
  const s = text(wpDate)
  if (!s || s.startsWith('0000')) return fallback
  const d = new Date(s.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString()
}

// ---- parse ------------------------------------------------------------------

export function parseWxr(xml: string, now: string): WxrResult {
  const td = makeTurndown()
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false })
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } }
  const items = asArray(doc?.rss?.channel?.item) as Record<string, unknown>[]

  const used = new Set<string>()
  const uniqueSlug = (base: string): string => {
    let slug = base || 'untitled'
    let n = 2
    while (used.has(slug)) slug = `${base}-${n++}`
    used.add(slug)
    return slug
  }

  const posts: ImportedPost[] = []
  const pages: ImportedPage[] = []
  let skipped = 0

  for (const item of items) {
    const type = text(item['wp:post_type'])
    const status = text(item['wp:status'])
    if ((type !== 'post' && type !== 'page') || !['publish', 'draft', 'pending', 'private'].includes(status)) {
      skipped++
      continue
    }
    const title = text(item.title).trim() || 'Untitled'
    const slug = uniqueSlug(slugify(text(item['wp:post_name']) || title))
    const html = raw(item['content:encoded'])
    const body = html ? td.turndown(html).trim() : ''
    const mappedStatus = status === 'publish' ? 'published' : 'draft'

    if (type === 'page') {
      pages.push({ title, slug, status: mappedStatus, content: body })
      continue
    }

    const cats: string[] = []
    const tags: string[] = []
    for (const c of asArray(item.category)) {
      const label = text(c).trim()
      if (!label) continue
      const domain = (c as Record<string, unknown>)['@_domain']
      if (domain === 'post_tag') tags.push(label)
      else if (domain === 'category' && label.toLowerCase() !== 'uncategorized') cats.push(label)
    }
    posts.push({
      title,
      slug,
      date: toIso(item['wp:post_date_gmt'] ?? item['wp:post_date'], now),
      status: mappedStatus,
      categories: [...new Set(cats)],
      tags: [...new Set(tags)],
      excerpt: text(item['excerpt:encoded']).trim() || deriveExcerpt(body),
      content: body,
    })
  }
  return { posts, pages, skipped }
}
