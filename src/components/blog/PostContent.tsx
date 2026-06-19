// Renders owner-authored markdown to HTML. Content is trusted (single author).
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

export async function PostContent({ markdown }: { markdown: string }) {
  const html = await marked.parse(markdown)
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
