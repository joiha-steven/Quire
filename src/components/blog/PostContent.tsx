// Renders owner-authored markdown to HTML. The blog is 100% Markdown: any raw
// HTML/CSS in the source is NOT rendered, it is escaped and shown verbatim as
// code. Only Markdown-generated elements (incl. GFM tables) are produced.
import { marked, type Tokens } from 'marked'
import { videoEmbed } from '@/lib/video'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

marked.setOptions({ gfm: true, breaks: true })
// Raw HTML tokens (block + inline) -> shown as visible text, never executed.
marked.use({
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(token.raw)
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
function buildFigures(html: string): string {
  return html
    .replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, '$1')
    .replace(/<img\b[^>]*>/g, (tag) => {
      const src = tag.match(/\bsrc="([^"]*)"/)?.[1]
      if (!src) return tag
      const alt = tag.match(/\balt="([^"]*)"/)?.[1] ?? ''
      const [cleanSrc, frag = ''] = src.split('#')
      const caption = alt ? `<figcaption>${alt}</figcaption>` : ''
      return `<figure class="${imgClasses(frag)}"><img src="${cleanSrc}" alt="${alt}">${caption}</figure>`
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
