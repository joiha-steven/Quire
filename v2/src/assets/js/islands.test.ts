// The islands, driven against a real DOM.
//
// Browser code is the one part of the server that `bun test` cannot reach by making a
// request, so without this file the only evidence that any of it runs is that the bundler
// accepted the syntax. happy-dom is registered for THIS FILE ONLY (`unregister` in
// `afterAll`): registering globally would hand the router tests happy-dom's `fetch` and
// `Response` instead of Bun's.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { backToTop } from './back-to-top'
import { codeCopy } from './code-copy'
import { comments as comments_ } from './comments'
import { lightbox } from './lightbox'
import { subscribe } from './subscribe'

// The island modules touch `document` when CALLED, never at import time, so importing
// them above the registration is safe. That is a property worth keeping: a module that
// read the DOM at import time would run at speculation time in a prerendered page.
beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const LABELS = {
  copyCode: 'Copy',
  copiedCode: 'Copied',
  backToTop: 'Back to top',
  lightboxPrev: 'Previous image',
  lightboxNext: 'Next image',
  lightboxClose: 'Close',
}

/** Rebuild the page. Every test starts from a document the server could have sent. */
function page(body: string, data: Record<string, string> = LABELS): void {
  document.body.innerHTML = body
  for (const key of Object.keys(document.body.dataset)) delete document.body.dataset[key]
  for (const [k, v] of Object.entries(data)) document.body.dataset[k] = v
}

const frame = () => new Promise((r) => requestAnimationFrame(r))

/** Pretend the document is `height` tall and the reader is `y` pixels down it. */
function scrolledTo(y: number, height: number, viewport = 800): void {
  const doc = document.documentElement
  Object.defineProperty(doc, 'scrollHeight', { value: height, configurable: true })
  Object.defineProperty(doc, 'clientHeight', { value: viewport, configurable: true })
  Object.defineProperty(doc, 'scrollTop', { value: y, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: viewport, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

beforeEach(() => page(''))

describe('code copy', () => {
  it('adds one button per code block, and adding it twice adds one', () => {
    page('<div class="prose"><pre><code>one</code></pre><pre><code>two</code></pre></div>')
    codeCopy()
    codeCopy()
    expect(document.querySelectorAll('.code-copy').length).toBe(2)
  })

  it('copies the code, says so, and goes back to saying "Copy"', async () => {
    page('<div class="prose"><pre><code>bun test</code></pre></div>')
    let written = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => { written = s; return Promise.resolve() } },
      configurable: true,
    })

    codeCopy()
    const btn = document.querySelector<HTMLButtonElement>('.code-copy')!
    expect(btn.textContent).toBe('Copy')
    btn.click()
    await Promise.resolve()
    expect(written).toBe('bun test')
    expect(btn.textContent).toBe('Copied')
    await new Promise((r) => setTimeout(r, 1600))
    expect(btn.textContent).toBe('Copy')
  })

  it('does nothing on a page with no code', () => {
    page('<div class="prose"><p>words</p></div>')
    codeCopy()
    expect(document.querySelector('.code-copy')).toBeNull()
  })
})

// The reading-progress bar has no test here because it has no JavaScript: it is markup the
// server emits and a scroll-driven CSS animation. That it appears at all is covered by the
// router tests; that it moves is the browser's job, not this bundle's.

describe('back to top', () => {
  it('appears only once the reader is past the first viewport', async () => {
    page('<article>x</article>')
    backToTop()
    const btn = document.querySelector<HTMLButtonElement>('.to-top')!
    expect(btn.getAttribute('aria-label')).toBe('Back to top')

    scrolledTo(200, 4000)
    await frame()
    expect(btn.classList.contains('shown')).toBe(false)

    scrolledTo(900, 4000) // past one 800px viewport
    await frame()
    expect(btn.classList.contains('shown')).toBe(true)
  })
})

describe('lightbox', () => {
  const gallery = `<div class="prose">
    <figure><img src="/a.jpg" alt="First"></figure>
    <figure><img src="/b.jpg" alt="Second"></figure>
    <p><img src="/inline.jpg" alt="Not in a figure"></p>
  </div>`

  const openFirst = () => {
    lightbox()
    document.querySelector<HTMLImageElement>('.prose figure img')!.click()
    return document.querySelector<HTMLDialogElement>('.lightbox')!
  }

  it('opens as a modal dialog, showing its position in the set', () => {
    page(gallery)
    const overlay = openFirst()
    expect(overlay).not.toBeNull()
    // A modal dialog, not a div: Escape, focus trapping and the inert background all come
    // from the browser rather than from this file.
    expect(overlay.tagName).toBe('DIALOG')
    expect(overlay.open).toBe(true)
    expect(overlay.querySelector<HTMLImageElement>('.lightbox-img')!.src).toContain('/a.jpg')
    expect(overlay.querySelector('.lightbox-caption')!.textContent).toBe('First')
    expect(overlay.querySelector('.lightbox-count')!.textContent).toBe('1 / 2')
  })

  it('ignores an image that is not in a figure', () => {
    page(gallery)
    lightbox()
    document.querySelectorAll<HTMLImageElement>('.prose img')[2]!.click()
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('wraps around at both ends with the arrow keys, in one dialog', () => {
    page(gallery)
    const overlay = openFirst()
    const shown = () => document.querySelector<HTMLImageElement>('.lightbox-img')!.src

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(shown()).toContain('/b.jpg')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(shown()).toContain('/a.jpg') // past the end, back to the start
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(shown()).toContain('/b.jpg') // and before the start, round to the end
    // Navigating swaps the picture inside the dialog rather than replacing the dialog:
    // rebuilding it would drop focus and re-run `showModal` on every arrow press.
    expect(document.querySelectorAll('.lightbox').length).toBe(1)
    expect(overlay.open).toBe(true)
  })

  it('tears down on close, however it was closed, and restores scrolling', () => {
    page(gallery)
    const overlay = openFirst()
    expect(document.body.style.overflow).toBe('hidden')
    // The browser fires `close` for Escape and for the buttons alike, which is why the
    // teardown is written once and hung off the event rather than off each path.
    overlay.close()
    expect(document.querySelector('.lightbox')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    // A stale keydown handler would throw, or move a viewer that is no longer there.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('closes on the close button', () => {
    page(gallery)
    const overlay = openFirst()
    overlay.querySelector<HTMLButtonElement>('.lightbox-close')!.click()
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('reopens cleanly after a close', () => {
    page(gallery)
    openFirst()
    document.querySelector<HTMLDialogElement>('.lightbox')!.close()
    document.querySelectorAll<HTMLImageElement>('.prose figure img')[1]!.click()
    const overlay = document.querySelector<HTMLDialogElement>('.lightbox')!
    expect(overlay.open).toBe(true)
    expect(overlay.querySelector('.lightbox-count')!.textContent).toBe('2 / 2')
  })

  it('leaves a single image without prev/next controls', () => {
    page('<div class="prose"><figure><img src="/only.jpg" alt="Only"></figure></div>')
    const overlay = openFirst()
    expect(overlay.querySelector('.lightbox-prev')).toBeNull()
    expect(overlay.querySelector('.lightbox-count')).toBeNull()
  })

  it('does nothing on an article with no figures', () => {
    page('<div class="prose"><p>words</p></div>')
    lightbox()
    expect(document.querySelector('.lightbox')).toBeNull()
  })
})

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
    comments_()
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
    expect(() => comments_()).not.toThrow()
  })
})
