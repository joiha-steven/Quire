// These two pages are the only HTML the newsletter builds by hand, outside the renderer
// and its escaping. They each carry a value into an ATTRIBUTE (`href`, `action`), which is
// why the escaper has to cover `"` and not just the text-node characters — it did not, on
// one of the two pages, for as long as there were two copies of it.
import { describe, it, expect } from 'bun:test'
import { resultPage, confirmPage } from '@/news/newsletter-html'

const body = (r: Response) => r.text()

describe('resultPage', () => {
  it('escapes a quote in the home URL instead of ending the href early', async () => {
    const html = await body(resultPage('T', '', 'https://e.com/"onmouseover="alert(1)', 'Home'))
    expect(html).toContain('href="https://e.com/&quot;onmouseover=&quot;alert(1)"')
    expect(html).not.toContain('onmouseover="alert')
  })

  it('escapes the text it is given', async () => {
    const html = await body(resultPage('<script>x</script>', '&', 'https://e.com', 'Home'))
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<p>&amp;</p>')
    expect(html).not.toContain('<script>x')
  })

  it('drops the paragraph entirely when there is no body', async () => {
    expect(await body(resultPage('T', '', 'https://e.com', 'Home'))).not.toContain('<p></p>')
  })
})

describe('confirmPage', () => {
  it('escapes a quote in the form action', async () => {
    const html = await body(confirmPage('T', '', 'Go', '/x?t="><script>alert(1)</script>'))
    expect(html).toContain('action="/x?t=&quot;&gt;&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
  })

  it('posts rather than links, so a link scanner cannot trigger the action', async () => {
    const html = await body(confirmPage('T', '', 'Go', '/unsub?t=abc'))
    expect(html).toContain('<form method="post"')
    expect(html).not.toContain('<a href="/unsub')
  })
})
