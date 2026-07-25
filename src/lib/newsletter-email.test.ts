import { describe, it, expect } from 'vitest'
import en from '@/locales/en'
import { THEME_PRESETS } from '@/lib/themes'
import { confirmEmail, broadcastEmail, replyEmail } from '@/lib/newsletter-email'

const THEME = THEME_PRESETS[0].theme.light

describe('confirmEmail', () => {
  it('links the opt-in URL and escapes the site title', () => {
    const { subject, html } = confirmEmail(
      en,
      'My <b>Blog</b>',
      'https://blog.test/api/newsletter/confirm?token=TOK',
      'https://blog.test',
      THEME,
    )
    expect(subject).toContain('My <b>Blog</b>')
    expect(html).toContain('https://blog.test/api/newsletter/confirm?token=TOK')
    expect(html).toContain('My &lt;b&gt;Blog&lt;/b&gt;') // escaped in the body, not raw
    expect(html).not.toContain('<b>Blog</b>')
  })
})

describe('broadcastEmail', () => {
  const post = { slug: 'hello', title: 'A <b>Title</b>', excerpt: 'teaser' }

  it('links the post + a per-recipient unsubscribe, escapes the title', () => {
    const { subject, html } = broadcastEmail(en, 'My Blog', 'https://blog.test', [post], 'TOK123', THEME)
    expect(subject).toBe('A <b>Title</b> — My Blog')
    expect(html).toContain('https://blog.test/hello')
    expect(html).toContain('/api/newsletter/unsubscribe?token=TOK123')
    expect(html).toContain('A &lt;b&gt;Title&lt;/b&gt;') // escaped, not raw
    expect(html).toContain('teaser')
  })

  it('omits the excerpt block when there is none', () => {
    const { html } = broadcastEmail(en, 'B', 'https://x.test', [{ slug: 's', title: 'T', excerpt: null }], 'k', THEME)
    expect(html).not.toContain('<p></p>')
  })

  // The pixel is what makes the open rate real; the preview + test send must NOT carry
  // one, or reviewing an email would count as a subscriber opening it.
  it('embeds the open pixel only when given an open token', () => {
    const withPixel = broadcastEmail(en, 'B', 'https://x.test', [post], 'k', THEME, 'OPEN1').html
    expect(withPixel).toContain('https://x.test/api/newsletter/open?t=OPEN1')
    expect(withPixel).toContain('width="1" height="1"')

    const noPixel = broadcastEmail(en, 'B', 'https://x.test', [post], 'k', THEME).html
    expect(noPixel).not.toContain('/api/newsletter/open')
  })

  // Several posts are ONE digest, not one email each — the subject has to say so, and
  // every post must actually be in the body.
  it('builds a digest from several posts under one subject', () => {
    const posts = [
      { slug: 'one', title: 'First', excerpt: 'a' },
      { slug: 'two', title: 'Second', excerpt: 'b' },
      { slug: 'three', title: 'Third', excerpt: 'c' },
    ]
    const { subject, html } = broadcastEmail(en, 'My Blog', 'https://blog.test', posts, 'k', THEME)
    expect(subject).toBe('3 new posts — My Blog')
    for (const p of posts) expect(html).toContain(`https://blog.test/${p.slug}`)
    expect(html).toContain('First')
    expect(html).toContain('Third')
  })

  // Colours come from the owner's palette so the mail matches their blog; a hardcoded
  // palette would silently ignore a theme change.
  it('paints with the palette it is handed', () => {
    const custom = { ...THEME, bg: '#123456', heading: '#abcdef' }
    const { html } = broadcastEmail(en, 'B', 'https://x.test', [post], 'k', custom)
    expect(html).toContain('#123456')
    expect(html).toContain('#abcdef')
  })

  // Cover refs are stored store-relative; an inbox has no origin to resolve them against.
  it('makes a store-relative cover image absolute', () => {
    const { html } = broadcastEmail(
      en,
      'B',
      'https://x.test',
      [{ ...post, coverImage: '/uploads/cover.webp' }],
      'k',
      THEME,
    )
    expect(html).toContain('https://x.test/uploads/cover.webp')
  })
})

describe('replyEmail', () => {
  it('interpolates name + title and points at the comments anchor', () => {
    const { subject, html } = replyEmail(en, 'My Blog', 'https://blog.test', 'my-post', 'The Post', 'Alice', '<p>hi</p>', THEME)
    expect(subject).toContain('My Blog')
    expect(html).toContain('Alice')
    expect(html).toContain('The Post')
    expect(html).toContain('https://blog.test/my-post#comments')
    expect(html).toContain('<p>hi</p>')
  })
})
