// How much work is in flight, as an external store the progress bar can read.
//
// A navigation has two halves and they belong to different owners: React resolving the
// route's chunk (a transition, owned by the router) and the page asking for its own data
// (owned by `useView`). The bar has to cover both, and a counter neither of them has to
// import the other to reach is the smallest thing that does it.
//
// A counter rather than a boolean: two fetches can overlap, and the first one to finish
// must not switch the bar off while the second is still running.

let inFlight = 0
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function beginRequest(): void {
  inFlight += 1
  emit()
}

export function endRequest(): void {
  // Never below zero. A component unmounting mid-flight can end a request whose begin
  // belonged to a fetch that already reported, and a negative floor would leave the bar
  // stuck on for the rest of the session.
  inFlight = Math.max(0, inFlight - 1)
  emit()
}

export const getInFlight = (): number => inFlight

export function subscribeInFlight(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
