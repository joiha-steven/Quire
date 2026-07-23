import { describe, it, expect } from 'vitest'
import en from '@/locales/en'
import { broadcastEmail, replyEmail } from '@/lib/newsletter-email'

describe('broadcastEmail', () => {
  it('links the post + a per-recipient unsubscribe, escapes the title', () => {
    const { subject, html } = broadcastEmail(
      en,
      'My Blog',
      'https://blog.test',
      { slug: 'hello', title: 'A <b>Title</b>', excerpt: 'teaser' },
      'TOK123',
    )
    expect(subject).toBe('A <b>Title</b> — My Blog')
    expect(html).toContain('https://blog.test/hello')
    expect(html).toContain('/api/newsletter/unsubscribe?token=TOK123')
    expect(html).toContain('A &lt;b&gt;Title&lt;/b&gt;') // escaped, not raw
    expect(html).toContain('teaser')
  })

  it('omits the excerpt block when there is none', () => {
    const { html } = broadcastEmail(en, 'B', 'https://x.test', { slug: 's', title: 'T', excerpt: null }, 'k')
    expect(html).not.toContain('<p></p>')
  })
})

describe('replyEmail', () => {
  it('interpolates name + title and points at the comments anchor', () => {
    const { subject, html } = replyEmail(en, 'My Blog', 'https://blog.test', 'my-post', 'The Post', 'Alice', '<p>hi</p>')
    expect(subject).toContain('My Blog')
    expect(html).toContain('Alice')
    expect(html).toContain('The Post')
    expect(html).toContain('https://blog.test/my-post#comments')
    expect(html).toContain('<blockquote><p>hi</p></blockquote>')
  })
})
