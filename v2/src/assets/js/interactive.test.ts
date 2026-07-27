// The islands a reader interacts with: sign-up, comments, search.
//
// Split from `islands.test.ts` to stay under the 400-line rule. Same harness, same reason
// it is per-file: `GlobalRegistrator` replaces `fetch` and `Response`, and the router tests
// need Bun's.

import { beforeEach, describe, expect, it } from 'bun:test'
import { comments as mountComments } from './comments'
import { search } from './search'
import { subscribe } from './subscribe'
import { page, stubFetch, useDom } from './test-dom'

useDom()

beforeEach(() => page(''))

describe('subscribe', () => {
  const form = `<form class="subscribe" method="post" action="/api/subscribe">
    <input type="email" name="email">
    <button type="submit">Subscribe</button>
    <p class="subscribe-status"></p>
  </form>`

  const LABELS = { nlSuccess: 'Check your inbox.', nlNoMail: 'No mail configured.', nlInvalid: 'Bad address.', nlError: 'Something broke.' }

  /** Stand in for the network, and record what was sent. */
  function stubFetch(status: number, body: unknown): { calls: RequestInit[] } {
    const calls: RequestInit[] = []
    globalThis.fetch = (((_url: string, init: RequestInit) => {
      calls.push(init)
      return Promise.resolve(new Response(JSON.stringify(body), { status }))
    }) as unknown) as typeof fetch
    return { calls }
  }

  const submit = async () => {
    document.querySelector<HTMLFormElement>('form.subscribe')!
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    await new Promise((r) => setTimeout(r, 0))
  }

  it('posts the address and reports success without leaving the page', async () => {
    page(form, LABELS)
    document.querySelector<HTMLInputElement>('input[name=email]')!.value = 'reader@example.com'
    const { calls } = stubFetch(200, { status: 'sent' })
    subscribe()
    await submit()
    expect(calls.length).toBe(1)
    expect(String(calls[0]!.body)).toContain('reader@example.com')
    expect(document.querySelector('.subscribe-status')!.textContent).toBe('Check your inbox.')
  })

  it('says the address is wrong on a 400, and blames the server on a 500', async () => {
    // Telling a reader to check their address when the server failed sends them looking
    // for a typo that is not there.
    for (const [status, expected] of [[400, 'Bad address.'], [500, 'Something broke.']] as const) {
      page(form, LABELS)
      document.querySelector<HTMLInputElement>('input[name=email]')!.value = 'x@y.zz'
      stubFetch(status, { error: 'nope' })
      subscribe()
      await submit()
      expect(document.querySelector('.subscribe-status')!.textContent).toBe(expected)
    }
  })

  it('does nothing at all on a page with no form', () => {
    page('<article>x</article>', LABELS)
    expect(() => subscribe()).not.toThrow()
  })
})

describe('comments', () => {
  const mount = '<section id="comments" data-post="a-post"></section>'
  const LABELS = {
    commentsHeading: 'Comments', commentsEmpty: 'No comments yet.', commentReply: 'Reply',
    commentDeleted: '[removed]', commentName: 'Name', commentEmail: 'Email',
    commentEmailNote: 'Not published', commentWebsite: 'Website', commentBody: 'Comment',
    commentSubmit: 'Post', commentError: 'Could not post.',
  }

  const tree = [{
    id: 1, parentId: null, name: 'Reader', contentHtml: '<p>Top level</p>',
    createdAt: '2020-01-01T00:00:00.000Z', deleted: false,
    replies: [{
      id: 2, parentId: 1, name: 'Author', contentHtml: '<p>A reply</p>',
      createdAt: '2020-01-02T00:00:00.000Z', deleted: false, replies: [],
    }],
  }]

  function stubFetch(comments: unknown[]): void {
    globalThis.fetch = ((() =>
      Promise.resolve(new Response(JSON.stringify({ comments })))) as unknown) as typeof fetch
  }

  /** The island waits for an intersection; drive it directly instead of faking a scroll. */
  async function mountAndLoad(comments: unknown[]): Promise<void> {
    page(mount, LABELS)
    stubFetch(comments)
    let fire: (() => void) | null = null
    globalThis.IntersectionObserver = class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        fire = () => cb([{ isIntersecting: true }])
      }
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof IntersectionObserver
    mountComments()
    fire!()
    await new Promise((r) => setTimeout(r, 0))
  }

  it('renders a thread, nested, with the reply form', async () => {
    await mountAndLoad(tree)
    const root = document.querySelector('#comments')!
    expect(root.querySelector('h2')!.textContent).toBe('Comments')
    expect(root.querySelectorAll('.comment').length).toBe(2)
    // The reply is INSIDE its parent, not a sibling: a flat render loses the conversation.
    expect(root.querySelector('.comment .comment-replies .comment')).not.toBeNull()
    expect(root.querySelector('.comment-form')).not.toBeNull()
  })

  it('puts a name through textContent and a body through innerHTML', async () => {
    // The body was sanitised server-side by comment-md.ts. The NAME was not. Reversing
    // these two is how a comment section becomes an XSS on every reader of the post.
    await mountAndLoad([{
      id: 1, parentId: null, name: '<img src=x onerror=alert(1)>',
      contentHtml: '<p>Body <em>with</em> markup</p>',
      createdAt: '2020-01-01T00:00:00.000Z', deleted: false, replies: [],
    }])
    const root = document.querySelector('#comments')!
    expect(root.querySelector('.comment-name img')).toBeNull()
    expect(root.querySelector('.comment-name')!.textContent).toContain('onerror')
    expect(root.querySelector('.comment-body em')).not.toBeNull()
  })

  it('marks a stranger\'s link nofollow, noopener and ugc', async () => {
    await mountAndLoad([{
      id: 1, parentId: null, name: 'Reader', website: 'https://example.com',
      contentHtml: '<p>x</p>', createdAt: '2020-01-01T00:00:00.000Z', deleted: false, replies: [],
    }])
    expect(document.querySelector('.comment-name a')!.getAttribute('rel'))
      .toBe('nofollow noopener ugc')
  })

  it('shows a removed comment as removed, with no reply button', async () => {
    await mountAndLoad([{
      id: 1, parentId: null, name: 'Reader', contentHtml: '<p>secret</p>',
      createdAt: '2020-01-01T00:00:00.000Z', deleted: true, replies: [],
    }])
    const root = document.querySelector('#comments')!
    expect(root.querySelector('.comment-body')!.textContent).toBe('[removed]')
    expect(root.querySelector('.comment-body')!.innerHTML).not.toContain('secret')
    expect(root.querySelector('.comment-reply')).toBeNull()
  })

  it('says so when there are none', async () => {
    await mountAndLoad([])
    expect(document.querySelector('#comments .empty')!.textContent).toBe('No comments yet.')
  })

  it('does nothing on a page with no thread', () => {
    page('<article>x</article>', LABELS)
    expect(() => mountComments()).not.toThrow()
  })
})

describe('search overlay', () => {
  const header = '<a class="icon-btn" href="/search" data-search-open>search</a>'
  const LABELS = {
    search: 'Search', searchHint: 'Type to search posts.', searchEmpty: 'Nothing found.',
    lightboxClose: 'Close',
  }

  const results = [{ slug: 'timezone-bugs', title: 'Timezone bugs', date: '2020-01-01' }]

  /** Stand in for the network, recording every URL and optionally delaying the answer. */
  function stubFetch(byQuery: Record<string, unknown[]>, delays: Record<string, number> = {}) {
    const urls: string[] = []
    globalThis.fetch = (((url: string) => {
      urls.push(url)
      const q = new URL(url, 'http://x').searchParams.get('q') ?? ''
      const body = JSON.stringify(byQuery[q] ?? [])
      const delay = delays[q] ?? 0
      return new Promise((resolve) =>
        setTimeout(() => resolve(new Response(body)), delay))
    }) as unknown) as typeof fetch
    return { urls }
  }

  const openOverlay = () => {
    search()
    document.querySelector<HTMLAnchorElement>('[data-search-open]')!
      .dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }))
    return document.querySelector<HTMLDialogElement>('.search-overlay')!
  }

  const type = async (value: string, wait = 260) => {
    const input = document.querySelector<HTMLInputElement>('.search-input')!
    input.value = value
    input.dispatchEvent(new Event('input'))
    await new Promise((r) => setTimeout(r, wait))
  }

  it('opens a modal dialog and starts with the hint, not with an empty list', async () => {
    page(header, LABELS)
    stubFetch({})
    const overlay = openOverlay()
    expect(overlay.tagName).toBe('DIALOG')
    expect(overlay.open).toBe(true)
    expect(overlay.querySelector('.empty')!.textContent).toBe('Type to search posts.')
  })

  it('searches and lists what it found', async () => {
    page(header, LABELS)
    stubFetch({ timezone: results })
    openOverlay()
    await type('timezone')
    const links = document.querySelectorAll('.search-results a')
    expect(links.length).toBe(1)
    expect(links[0]!.textContent).toBe('Timezone bugs')
    expect(links[0]!.getAttribute('href')).toBe('/timezone-bugs')
  })

  it('sends ONE request for a burst of typing', async () => {
    page(header, LABELS)
    const { urls } = stubFetch({ timezone: results })
    openOverlay()
    const input = document.querySelector<HTMLInputElement>('.search-input')!
    for (const v of ['t', 'ti', 'tim', 'time', 'timezone']) {
      input.value = v
      input.dispatchEvent(new Event('input'))
    }
    await new Promise((r) => setTimeout(r, 300))
    expect(urls.length).toBe(1)
  })

  it('ignores a slow answer that arrives after a newer one', async () => {
    // The out-of-order case. Without the sequence number, a slow response for "ti" lands
    // after a fast one for "timezone" and replaces the right answer with a stale one.
    page(header, LABELS)
    stubFetch(
      { ti: [{ slug: 'stale', title: 'Stale result', date: '2020-01-01' }], timezone: results },
      { ti: 300, timezone: 0 },
    )
    openOverlay()
    await type('ti', 220)
    await type('timezone', 400)
    const links = document.querySelectorAll('.search-results a')
    expect(links.length).toBe(1)
    expect(links[0]!.textContent).toBe('Timezone bugs')
  })

  it('says so when nothing matches', async () => {
    page(header, LABELS)
    stubFetch({ zzz: [] })
    openOverlay()
    await type('zzz')
    expect(document.querySelector('.search-results .empty')!.textContent).toBe('Nothing found.')
  })

  it('opens on "/" but not while the reader is typing somewhere else', () => {
    page(`${header}<input id="other">`, LABELS)
    stubFetch({})
    search()

    document.querySelector<HTMLInputElement>('#other')!.focus()
    dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    expect(document.querySelector('.search-overlay')).toBeNull()

    document.querySelector<HTMLInputElement>('#other')!.blur()
    dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    expect(document.querySelector<HTMLDialogElement>('.search-overlay')!.open).toBe(true)
  })

  it('does nothing on a page with no trigger', () => {
    page('<article>x</article>', LABELS)
    expect(() => search()).not.toThrow()
    expect(document.querySelector('.search-overlay')).toBeNull()
  })
})
