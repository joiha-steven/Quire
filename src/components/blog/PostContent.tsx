// Renders owner-authored markdown to HTML. Content is trusted (single author),
// so embedded HTML (e.g. video iframes) is allowed through.
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

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
