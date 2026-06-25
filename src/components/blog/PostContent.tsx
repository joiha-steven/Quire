// Markdown -> HTML. 100% Markdown: raw HTML/CSS is escaped and shown verbatim,
// never rendered. Only Markdown-generated elements (incl. GFM tables) are produced.
import { marked, type Tokens } from 'marked'
import { videoEmbed } from '@/lib/video'
import { collapseBlob } from '@/lib/blob'
import { highlightCode } from '@/lib/highlight'
import { slugify } from '@/lib/utils'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Escape a string for use inside a double-quoted HTML attribute.
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

// Drop dangerous schemes (javascript:/data:/vbscript:) — marked v5+ no longer
// sanitizes URLs. Strip control chars first so `java\tscript:` can't slip through.
const safeHref = (href: string): string => {
  const cleaned = href.trim().replace(/[\u0000-\u001F\u007F]/g, '')
  return /^(?:javascript|data|vbscript):/i.test(cleaned) ? '#' : cleaned
}

// Reverse of escapeHtml — Shiki needs the raw text back before re-highlighting.
const unescapeHtml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

// Swap marked's `<pre><code>` blocks for Shiki-highlighted markup (parallel; a
// null result leaves the original block untouched).
async function highlightBlocks(html: string): Promise<string> {
  const re = /<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g
  const matches = [...html.matchAll(re)]
  if (matches.length === 0) return html
  const out = await Promise.all(
    matches.map((m) => highlightCode(unescapeHtml(m[2]), (m[1] || 'text').toLowerCase())),
  )
  let i = 0
  return html.replace(re, (whole) => out[i++] ?? whole)
}

marked.setOptions({ gfm: true, breaks: true })
marked.use({
  renderer: {
    // Raw HTML tokens (block + inline) -> shown as visible text, never executed.
    html(token: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(token.raw)
    },
    // H2/H3 slug ids for ToC anchors; duplicates de-duped in dedupeHeadingIds
    // (kept in sync with extractHeadings).
    heading(token: Tokens.Heading) {
      const inner = this.parser.parseInline(token.tokens)
      // Only H2/H3 get anchors; a heading that slugifies to "" (e.g. "### !!!")
      // gets no id rather than an invalid id="" (kept in sync with extractHeadings).
      const slug = token.depth === 2 || token.depth === 3 ? slugify(token.text) : ''
      const id = slug ? ` id="${slug}"` : ''
      return `<h${token.depth}${id}>${inner}</h${token.depth}>\n`
    },
    // Sanitize link hrefs (drop javascript:/data:/vbscript:); marked no longer does.
    link(token: Tokens.Link) {
      const inner = this.parser.parseInline(token.tokens)
      const title = token.title ? ` title="${escapeAttr(token.title)}"` : ''
      return `<a href="${escapeAttr(safeHref(token.href))}"${title}>${inner}</a>`
    },
  },
})

// 2nd occurrence of a slug → `slug-2`, etc. MUST match extractHeadings' counter
// (both walk H2/H3 in document order) or the ToC anchors break.
function dedupeHeadingIds(html: string): string {
  const counts = new Map<string, number>()
  return html.replace(/(<h[23] id=")([^"]*)(")/g, (whole, pre, id, post) => {
    const n = counts.get(id) ?? 0
    counts.set(id, n + 1)
    return n === 0 ? whole : `${pre}${id}-${n + 1}${post}`
  })
}

// Intrinsic dims of uploaded originals, keyed by collapsed pathname. width/height
// on the <img> reserves the box from the aspect ratio → no CLS.
export type ImageDims = Map<string, { width: number; height: number }>

// Figure placement from the src fragment: #left|#right (align, default center),
// #wide (30% wider, breaks out). Caption = alt.
function imgClasses(frag: string): string {
  // Exact hyphen tokens so `#bright` can't match `right`: left|right|wide|left-wide|right-wide.
  const tokens = frag.split('-')
  // `#grid` marks a gallery item; groupGalleries() wraps consecutive ones. The
  // grid owns layout, so align/wide are ignored for a grid item.
  if (tokens.includes('grid')) return 'img-grid'
  const align = tokens.includes('left') ? 'img-left' : tokens.includes('right') ? 'img-right' : 'img-center'
  return tokens.includes('wide') ? `${align} img-wide` : align
}

// Wrap a run of 2+ consecutive `#grid` figures (separated only by whitespace)
// into one `.gallery` grid container. A lone grid image stays a normal figure.
function groupGalleries(html: string): string {
  return html.replace(/(?:<figure class="img-grid">[\s\S]*?<\/figure>\s*){2,}/g, (run) => `<div class="gallery">${run.trim()}</div>`)
}

// <picture> (AVIF/WebP @1024/1600) ONLY for raster originals with confirmed
// variants (`ready`). A <picture> has no fallback on a 404 source, so anything
// unconfirmed renders as a plain <img> of the original (always loads).
const SIZES_ATTR = '(max-width: 768px) 100vw, 768px'
function responsiveSources(cleanSrc: string, ready: Set<string>): string | null {
  const m = cleanSrc.match(/^(.*\/media\/.+)\.(?:jpe?g|png)$/i)
  if (!m) return null
  if (!ready.has(collapseBlob(cleanSrc))) return null // variants not generated -> plain <img>
  const set = (fmt: string) => `${m[1]}-1024.${fmt} 1024w, ${m[1]}-1600.${fmt} 1600w`
  return (
    `<source type="image/avif" srcset="${set('avif')}" sizes="${SIZES_ATTR}">` +
    `<source type="image/webp" srcset="${set('webp')}" sizes="${SIZES_ATTR}">`
  )
}
function buildFigures(html: string, ready: Set<string>, dims: ImageDims): string {
  let seen = 0 // index of the image within the body, in source order
  return html
    .replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, '$1')
    .replace(/<img\b[^>]*>/g, (tag) => {
      const src = tag.match(/\bsrc="([^"]*)"/)?.[1]
      if (!src) return tag
      const alt = tag.match(/\balt="([^"]*)"/)?.[1] ?? ''
      const [cleanSrc, frag = ''] = src.split('#')
      const caption = alt ? `<figcaption>${alt}</figcaption>` : ''
      // Intrinsic size (when known) reserves the box -> no CLS as it loads.
      const d = dims.get(collapseBlob(cleanSrc))
      const sizeAttrs = d ? ` width="${d.width}" height="${d.height}"` : ''
      // First image = likely LCP → eager + high priority; later images stay lazy.
      const priority = seen === 0 ? ' fetchpriority="high"' : ' loading="lazy"'
      seen++
      const img = `<img src="${cleanSrc}" alt="${alt}"${sizeAttrs}${priority}>`
      const sources = responsiveSources(cleanSrc, ready)
      const media = sources ? `<picture>${sources}${img}</picture>` : img
      return `<figure class="${imgClasses(frag)}">${media}${caption}</figure>`
    })
}

// Turn a standalone video URL (bare or autolinked by marked) into a responsive
// embed. The iframe HTML is ours (trusted), added after marked has run.
function buildVideos(html: string): string {
  return html.replace(
    /<p>\s*(?:<a\b[^>]*href="([^"]+)"[^>]*>[^<]*<\/a>|([^<\s]+))\s*<\/p>/g,
    (whole, hrefUrl?: string, textUrl?: string) => {
      const v = videoEmbed((hrefUrl || textUrl || '').trim())
      if (!v) return whole
      return `<div class="video-embed"><iframe src="${v.embed}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    },
  )
}

export async function PostContent({
  markdown,
  readyOriginals = new Set(),
  imageDims = new Map(),
}: {
  markdown: string
  // Collapsed pathnames (media/x.jpg) whose AVIF/WebP variants exist. Images not
  // in this set render as a plain <img> of the original (no broken <picture>).
  readyOriginals?: Set<string>
  // Intrinsic width/height per collapsed pathname (for CLS-free rendering).
  imageDims?: ImageDims
}) {
  const parsed = dedupeHeadingIds(buildVideos(groupGalleries(buildFigures(await marked.parse(markdown), readyOriginals, imageDims))))
  const html = await highlightBlocks(parsed)
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
