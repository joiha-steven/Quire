// Renders owner-authored markdown to HTML. The blog is 100% Markdown: any raw
// HTML/CSS in the source is NOT rendered, it is escaped and shown verbatim as
// code. Only Markdown-generated elements (incl. GFM tables) are produced.
import { marked, type Tokens } from 'marked'

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

// Wrap each image in a <figure>: caption (from alt) below, and full-bleed when
// the src carries a "#full" marker. Lone images sit in their own <p>, which we
// unwrap first so the block-level <figure> is valid.
function buildFigures(html: string): string {
  return html
    .replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, '$1')
    .replace(/<img\b[^>]*>/g, (tag) => {
      const src = tag.match(/\bsrc="([^"]*)"/)?.[1]
      if (!src) return tag
      const alt = tag.match(/\balt="([^"]*)"/)?.[1] ?? ''
      const full = src.includes('#full')
      const cleanSrc = src.replace(/#full$/, '')
      const caption = alt ? `<figcaption>${alt}</figcaption>` : ''
      return `<figure class="${full ? 'img-full' : ''}"><img src="${cleanSrc}" alt="${alt}">${caption}</figure>`
    })
}

export async function PostContent({ markdown }: { markdown: string }) {
  const html = buildFigures(await marked.parse(markdown))
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
