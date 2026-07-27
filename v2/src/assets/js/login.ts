// The sign-in page's only script.
//
// Both behaviours here are CONVENIENCES. The form is a real form with a method and an
// action, so sign-in works with this file blocked, failed or switched off — which matters
// more on this page than anywhere else on the site, because it is the one page you cannot
// route around.

/** Show/hide the password, and keep the button's label honest about what it will do. */
function reveal(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-reveal]')
  const input = document.querySelector<HTMLInputElement>('#password')
  if (button === null || input === null) return

  button.addEventListener('click', () => {
    const nowVisible = input.type === 'password'
    input.type = nowVisible ? 'text' : 'password'
    // The label describes the ACTION, so it is the opposite of the current state.
    button.setAttribute('aria-label', nowVisible ? button.dataset.hide ?? '' : button.dataset.show ?? '')
    // Focus returns to the field with the caret where it was. Without this the button
    // keeps focus and the next keystroke goes nowhere.
    const at = input.value.length
    input.focus()
    input.setSelectionRange(at, at)
  })
}

/**
 * Warn about Caps Lock.
 *
 * `getModifierState` is the only reliable way: inferring it from the case of typed
 * characters fails for anyone whose password has no letters, and fails differently on
 * every keyboard layout.
 */
function capsLock(): void {
  const notice = document.querySelector<HTMLElement>('[data-caps]')
  const input = document.querySelector<HTMLInputElement>('#password')
  if (notice === null || input === null) return

  const update = (event: KeyboardEvent): void => {
    notice.hidden = !event.getModifierState('CapsLock')
  }
  input.addEventListener('keydown', update)
  input.addEventListener('keyup', update)
  // Hidden on blur: the warning is about what is being typed, and leaving it on screen
  // after the field is abandoned is just noise.
  input.addEventListener('blur', () => { notice.hidden = true })
}

/**
 * Let a pasted code submit itself.
 *
 * A six-digit code copied from a notification is a paste followed by a hunt for the
 * button. This removes the hunt, and only fires on a complete code, so it cannot submit
 * something half-entered.
 */
function otpPaste(): void {
  const input = document.querySelector<HTMLInputElement>('#code[inputmode="numeric"]')
  if (input === null) return

  input.addEventListener('input', () => {
    // Strip whatever the source wrapped it in: some apps copy "123 456".
    const digits = input.value.replace(/\D/g, '')
    if (digits !== input.value) input.value = digits
    if (digits.length === 6) input.form?.requestSubmit()
  })
}

reveal()
capsLock()
otpPaste()
