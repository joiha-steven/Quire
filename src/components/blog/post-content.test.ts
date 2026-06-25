import { describe, it, expect } from 'vitest'
import { PostContent } from './PostContent'
import { extractHeadings } from '@/lib/utils'

// PostContent is a plain async server component: call it as a function and read
// the HTML it emits via dangerouslySetInnerHTML. Markdown WITHOUT code fences so
// Shiki never runs -> the test stays offline + fast.
async function render(markdown: string): Promise<string> {
  const el = await PostContent({ markdown })
  const props = (el as unknown as { props: { dangerouslySetInnerHTML?: { __html: string } } }).props
  return props.dangerouslySetInnerHTML?.__html ?? ''
}

describe('markdown render — security', () => {
  it('escapes raw HTML instead of executing it (<script> shown as text)', async () => {
    const html = await render('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('renders an onerror <img> inert (escaped), not a live tag', async () => {
    const html = await render('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
    expect(html).not.toMatch(/<img[^>]*onerror/)
  })

  it('neutralizes a javascript: link href to #', async () => {
    const html = await render('[click me](javascript:alert(1))')
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })
})

describe('markdown render — structure', () => {
  it('gives H2 and H3 slug ids but leaves H1 without one', async () => {
    const html = await render('## Hello World\n\n### Sub Section\n\n# Big Title')
    expect(html).toContain('<h2 id="hello-world">')
    expect(html).toContain('<h3 id="sub-section">')
    expect(html).toContain('<h1>Big Title</h1>')
  })

  it('de-dupes ids for duplicate headings (foo, foo-2)', async () => {
    const html = await render('## Repeat\n\n## Repeat')
    expect(html).toContain('id="repeat"')
    expect(html).toContain('id="repeat-2"')
  })

  it('omits the id (not id="") for a heading that slugifies to empty', async () => {
    const html = await render('## !!!\n\n## Real One')
    expect(html).toContain('<h2>!!!</h2>')
    expect(html).not.toContain('id=""')
    expect(html).toContain('<h2 id="real-one">')
  })

  it('turns a standalone YouTube URL into a responsive iframe embed', async () => {
    const html = await render('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(html).toContain('<div class="video-embed">')
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('wraps a markdown image in a <figure> with the alt as <figcaption>', async () => {
    const html = await render('![A small cat](media/cat.jpg)')
    expect(html).toContain('<figure')
    expect(html).toContain('<figcaption>A small cat</figcaption>')
  })
})

describe('markdown render — ToC anchors stay in sync', () => {
  it('PostContent ids match extractHeadings ids on duplicate headings', async () => {
    const md = '## Foo\n\nbody\n\n## Foo\n\n### Bar'
    const html = await render(md)
    const renderedIds = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1])
    const tocIds = extractHeadings(md).map((h) => h.id)
    expect(renderedIds).toEqual(tocIds)
    expect(renderedIds).toEqual(['foo', 'foo-2', 'bar'])
  })

  it('skips an unanchorable heading in both the render and the ToC', async () => {
    const md = '## Intro\n\n## ???\n\n## Outro'
    const html = await render(md)
    const renderedIds = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1])
    const tocIds = extractHeadings(md).map((h) => h.id)
    expect(renderedIds).toEqual(tocIds)
    expect(renderedIds).toEqual(['intro', 'outro'])
  })
})
