// Renders owner-authored markdown to HTML. The blog is 100% Markdown: any raw
// HTML/CSS in the source is NOT rendered, it is escaped and shown verbatim as
// code. Only Markdown-generated elements (incl. GFM tables) are produced.
import { marked, type Tokens } from 'marked'
import { videoEmbed } from '@/lib/video'
import { slugify } from '@/lib/utils'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

marked.setOptions({ gfm: true, breaks: true })
marked.use({
  renderer: {
    // Raw HTML tokens (block + inline) -> shown as visible text, never executed.
    html(token: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(token.raw)
    },
    // Give H2/H3 slug ids so the table of contents can anchor to them.
    heading(token: Tokens.Heading) {
      const inner = this.parser.parseInline(token.tokens)
      const id = token.depth === 2 || token.depth === 3 ? ` id="${slugify(token.text)}"` : ''
      return `<h${token.depth}${id}>${inner}</h${token.depth}>\n`
    },
  },
})

// Wrap each image in a <figure>. Placement is encoded in the src fragment:
//   #left | #right        -> alignment (default center)
//   #wide / #left-wide... -> 30% wider than the column (breaks out)
// The caption is the image alt. Lone images sit in their own <p>, which we
// unwrap first so the block-level <figure> is valid.
function imgClasses(frag: string): string {
  const align = /left/.test(frag) ? 'img-left' : /right/.test(frag) ? 'img-right' : 'img-center'
  return /wide/.test(frag) ? `${align} img-wide` : align
}

// For an uploaded raster original (media/*.jpg|png), the AVIF/WebP @1024/1600
// variants exist by convention -> emit a <picture> so the browser picks the
// lightest format + best size. Other srcs (svg/webp/gif/external) stay plain.
const SIZES_ATTR = '(max-width: 768px) 100vw, 768px'
function responsiveSources(cleanSrc: string): string | null {
  const m = cleanSrc.match(/^(.*\/media\/.+)\.(?:jpe?g|png)$/i)
  if (!m) return null
  const set = (fmt: string) => `${m[1]}-1024.${fmt} 1024w, ${m[1]}-1600.${fmt} 1600w`
  return (
    `<source type="image/avif" srcset="${set('avif')}" sizes="${SIZES_ATTR}">` +
    `<source type="image/webp" srcset="${set('webp')}" sizes="${SIZES_ATTR}">`
  )
}
function buildFigures(html: string): string {
  return html
    .replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, '$1')
    .replace(/<img\b[^>]*>/g, (tag) => {
      const src = tag.match(/\bsrc="([^"]*)"/)?.[1]
      if (!src) return tag
      const alt = tag.match(/\balt="([^"]*)"/)?.[1] ?? ''
      const [cleanSrc, frag = ''] = src.split('#')
      const caption = alt ? `<figcaption>${alt}</figcaption>` : ''
      const img = `<img src="${cleanSrc}" alt="${alt}" loading="lazy">`
      const sources = responsiveSources(cleanSrc)
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

export async function PostContent({ markdown }: { markdown: string }) {
  const html = buildVideos(buildFigures(await marked.parse(markdown)))
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
