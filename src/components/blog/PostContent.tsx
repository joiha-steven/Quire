// Renders owner-authored markdown to HTML. Content is trusted (single author),
// so embedded HTML (e.g. video iframes) is allowed through.
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

// Images whose src ends with "#full" render full-bleed: strip the marker and tag
// them so CSS can break them out of the content column.
function applyFullImages(html: string): string {
  return html.replace(/<img\b[^>]*?>/g, (tag) => {
    if (!/src="[^"]*#full"/.test(tag)) return tag
    return tag.replace(/(src="[^"]*?)#full(")/, '$1$2').replace('<img', '<img class="img-full"')
  })
}

export async function PostContent({ markdown }: { markdown: string }) {
  const html = applyFullImages(await marked.parse(markdown))
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
