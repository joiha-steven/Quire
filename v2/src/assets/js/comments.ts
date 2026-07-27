// Comments: fetch the tree, render it, post a new one.
//
// Fetched rather than server-rendered, which is the frozen tree's design and the right one
// here for a specific reason: the article page is CACHED HTML (Invariant 1), and a comment
// is not a post. Rendering comments into the page would mean either flushing the whole page
// cache every time a stranger types something, or serving a stale thread. Fetching keeps
// both problems away.
//
// Loaded only when the thread scrolls into view. A reader who never reaches the bottom of
// the article never pays for it.

import { el, label } from './dom'

type Comment = {
  id: number
  parentId: number | null
  name: string
  website?: string
  contentHtml: string
  createdAt: string
  deleted: boolean
  replies: Comment[]
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * One comment and its replies.
 *
 * `contentHtml` is assigned with innerHTML, and that is safe for exactly one reason: the
 * server rendered it through the limited-markdown sanitiser in `comment-md.ts`. The author
 * NAME is not, so it goes through textContent. Getting those two the wrong way round is
 * how a comment section becomes an XSS on every reader of the post.
 */
function render(comment: Comment): HTMLElement {
  const item = el('li', { class: 'comment', id: `comment-${comment.id}` })

  const who = el('span', { class: 'comment-name' })
  if (comment.website) {
    // `rel` on a stranger's link: no ranking transfer, no window.opener, no referrer.
    const link = el('a', { href: comment.website, rel: 'nofollow noopener ugc' })
    link.textContent = comment.name
    who.appendChild(link)
  } else {
    who.textContent = comment.name
  }

  const when = el('time', { datetime: comment.createdAt })
  when.textContent = new Date(comment.createdAt).toLocaleDateString(document.documentElement.lang || 'en', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const body = el('div', { class: 'comment-body' })
  if (comment.deleted) body.textContent = label('commentDeleted')
  else body.innerHTML = comment.contentHtml

  const head = el('p', { class: 'comment-meta' }, who, ' · ', when)
  item.append(head, body)

  if (!comment.deleted) {
    const reply = el('button', { type: 'button', class: 'comment-reply' })
    reply.textContent = label('commentReply')
    reply.addEventListener('click', () => openForm(item, comment.id))
    item.appendChild(reply)
  }

  if (comment.replies.length) {
    const list = el('ul', { class: 'comment-replies' })
    for (const child of comment.replies) list.appendChild(render(child))
    item.appendChild(list)
  }
  return item
}

/** The form, built once per place it is opened. `parentId` null means a top-level comment. */
function buildForm(postSlug: string, parentId: number | null): HTMLFormElement {
  const field = (name: string, type: string, labelKey: string, required: boolean) => {
    const id = `c-${name}-${parentId ?? 'root'}`
    const input = el('input', {
      type, name, id, ...(required ? { required: 'required' } : {}),
    })
    const text = el('label', { for: id })
    text.textContent = label(labelKey)
    // The email note is a separate string in the locale table, so the label reads
    // "Email" and the hint sits beside it rather than inside the label text.
    if (name === 'email') text.append(` (${label('commentEmailNote')})`)
    return el('p', { class: 'comment-field' }, text, input)
  }

  const area = el('textarea', { name: 'content', rows: '4', required: 'required' })
  area.setAttribute('aria-label', label('commentBody'))

  const button = el('button', { type: 'submit' })
  button.textContent = label('commentSubmit')

  const form = el('form', { class: 'comment-form' },
    field('name', 'text', 'commentName', true),
    field('email', 'email', 'commentEmail', true),
    field('website', 'url', 'commentWebsite', false),
    area,
    button,
    el('p', { class: 'comment-status', role: 'status' }),
  ) as HTMLFormElement

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void submit(form, postSlug, parentId, button)
  })
  return form
}

/** Open a reply form under a comment, or close it if it is already there. */
function openForm(item: HTMLElement, parentId: number): void {
  const existing = item.querySelector(':scope > .comment-form')
  if (existing) {
    existing.remove()
    return
  }
  const root = document.querySelector<HTMLElement>('#comments')
  if (!root?.dataset.post) return
  item.appendChild(buildForm(root.dataset.post, parentId))
}

async function submit(
  form: HTMLFormElement, postSlug: string, parentId: number | null, button: HTMLButtonElement,
): Promise<void> {
  const status = form.querySelector<HTMLElement>('.comment-status')
  if (!status) return
  const data = Object.fromEntries(new FormData(form).entries())

  button.disabled = true
  status.textContent = ''
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, postSlug, parentId }),
    })
    if (!res.ok) {
      // The server's message, not a generic one: it says which field is wrong, and the
      // reader has to fix it themselves.
      const { error } = await res.json().catch(() => ({})) as { error?: string }
      status.textContent = error ?? label('commentError')
      return
    }
    form.reset()
    // No "posted!" line: the thread is re-read and the comment appears in it, which says
    // the same thing without a message the reader then has to dismiss.
    await load()
  } catch {
    status.textContent = label('commentError')
  } finally {
    button.disabled = false
  }
}

async function load(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#comments')
  const slug = root?.dataset.post
  if (!root || !slug) return

  let comments: Comment[] = []
  try {
    const res = await fetch(`/api/comments?post=${encodeURIComponent(slug)}`)
    ;({ comments } = await res.json() as { comments: Comment[] })
  } catch {
    root.textContent = label('commentError')
    return
  }

  root.replaceChildren()
  const heading = el('h2')
  heading.textContent = label('commentsHeading')
  root.appendChild(heading)

  if (comments.length) {
    const list = el('ul', { class: 'comment-list' })
    for (const comment of comments) list.appendChild(render(comment))
    root.appendChild(list)
  } else {
    const empty = el('p', { class: 'empty' })
    empty.textContent = label('commentsEmpty')
    root.appendChild(empty)
  }
  root.appendChild(buildForm(slug, null))
}

export function comments(): void {
  const root = document.querySelector<HTMLElement>('#comments')
  if (!root?.dataset.post) return

  // Nothing is fetched until the thread is near the viewport. Most readers never reach it,
  // and a request they never see is a request not worth making.
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return
    observer.disconnect()
    void load()
  }, { rootMargin: '400px' })
  observer.observe(root)
}
