// Newsletter sign-up, enhanced.
//
// The form is REAL: server-rendered, with a method and an action, and `/api/subscribe`
// answers a form post with an HTML page. So this file is enhancement in the strict sense —
// with it, the reader stays on the article and sees the result inline; without it, they get
// a page telling them to check their email. Neither path is broken.

import { label } from './dom'

export function subscribe(): void {
  const form = document.querySelector<HTMLFormElement>('form.subscribe')
  if (!form) return
  const status = form.querySelector<HTMLElement>('.subscribe-status')
  const button = form.querySelector<HTMLButtonElement>('button')
  if (!status || !button) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = new FormData(form).get('email')
    if (typeof email !== 'string' || !email) return

    button.disabled = true
    status.textContent = ''
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({})) as { status?: string }
      if (!res.ok) {
        // 400 is a malformed address; anything else is the server's problem, not the
        // reader's, and saying "check your address" for a 500 sends them looking for a
        // typo that is not there.
        status.textContent = res.status === 400 ? label('nlInvalid') : label('nlError')
        return
      }
      // "Already subscribed" deliberately reads the same as a fresh sign-up. The server
      // does not distinguish them either, so that the endpoint cannot be used to test
      // whether a given address reads this blog.
      status.textContent = data.status === 'pending_no_mail' ? label('nlNoMail') : label('nlSuccess')
      form.reset()
    } catch {
      status.textContent = label('nlError')
    } finally {
      button.disabled = false
    }
  })
}
