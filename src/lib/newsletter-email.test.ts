import { describe, it, expect } from 'vitest'
import en from '@/locales/en'
import { confirmEmail, broadcastEmail, replyEmail } from '@/lib/newsletter-email'

describe('confirmEmail', () => {
  it('links the opt-in URL and escapes the site title', () => {
    const { subject, html } = confirmEmail(en, 'My <b>Blog</b>', 'https://blog.test/api/newsletter/confirm?token=TOK')
    expect(subject).toContain('My <b>Blog</b>')
    expect(html).toContain('https://blog.test/api/newsletter/confirm?token=TOK')
    expect(html).toContain('My &lt;b&gt;Blog&lt;/b&gt;') // escaped in the body, not raw
    expect(html).not.toContain('<b>Blog</b>')
  })
})

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

  // The pixel is what makes the open rate real; the preview + test send must NOT carry
  // one, or reviewing an email would count as a subscriber opening it.
  it('embeds the open pixel only when given an open token', () => {
    const withPixel = broadcastEmail(en, 'B', 'https://x.test', { slug: 's', title: 'T' }, 'k', 'OPEN1').html
    expect(withPixel).toContain('https://x.test/api/newsletter/open?t=OPEN1')
    expect(withPixel).toContain('width="1" height="1"')

    const noPixel = broadcastEmail(en, 'B', 'https://x.test', { slug: 's', title: 'T' }, 'k').html
    expect(noPixel).not.toContain('/api/newsletter/open')
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
