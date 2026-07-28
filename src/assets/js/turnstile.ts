// The Cloudflare Turnstile widget on the comment form.
//
// The server half has been there since M3 — `/api/comments` refuses a comment whose token
// does not verify whenever the owner has Turnstile on and the keys are set. Without this
// file the reader had no way to produce that token, so on a site with Turnstile enabled
// every comment was rejected and the form looked broken. A verifier with nothing to verify
// is not a half-built feature; it is a closed door.
//
// The script is loaded ONCE and only on a page that actually renders a form, so a reader
// who never opens the comments never fetches it — and a site with Turnstile off never
// references Cloudflare at all.

type RenderOptions = {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

type TurnstileApi = {
  render: (el: HTMLElement, opts: RenderOptions) => string
  remove: (id: string) => void
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const api = (): TurnstileApi | undefined =>
  (window as unknown as { turnstile?: TurnstileApi }).turnstile

/** Load the script once, however many forms ask for it. */
let loading: Promise<void> | null = null
function load(): Promise<void> {
  if (api()) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = SCRIPT
    tag.async = true
    tag.onload = () => resolve()
    tag.onerror = () => reject(new Error('turnstile script failed to load'))
    document.head.appendChild(tag)
  })
  return loading
}

/**
 * Mount a widget in `form` and keep its token in a hidden field.
 *
 * The token goes in the FORM rather than in a variable, because the submit handler reads
 * the form with `FormData` — so the token travels the same way every other field does and
 * there is no second path to keep in step. An expiry or an error clears it, which re-gates
 * the submit exactly as a missing token would.
 */
export function mountTurnstile(form: HTMLFormElement, siteKey: string): void {
  const holder = document.createElement('div')
  holder.className = 'turnstile'
  const token = document.createElement('input')
  token.type = 'hidden'
  token.name = 'turnstileToken'
  form.insertBefore(holder, form.querySelector('button'))
  form.appendChild(token)

  void load().then(() => {
    const t = api()
    if (!t) return
    t.render(holder, {
      sitekey: siteKey,
      callback: (value) => { token.value = value },
      'expired-callback': () => { token.value = '' },
      'error-callback': () => { token.value = '' },
    })
  }).catch(() => {
    // Cloudflare unreachable. Leave the token empty: the server will refuse the comment,
    // which is the correct end state — failing OPEN here would make the check optional.
  })
}
