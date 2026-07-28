// Unwrap an API response in tests.
//
// Every route answers in the frozen tree's envelope — `{ success, data }` — because 68
// admin components read it that way. Tests assert on the payload, not the wrapper, so this
// unwraps once here rather than at 124 call sites, and a route that ever forgets the
// envelope fails loudly instead of returning a shape that merely looks plausible.

export async function payload<T>(res: Response | Promise<Response>): Promise<T> {
  const body = await (await res).json() as { data?: T }
  // `?? body` so a route that legitimately answers with a bare shape (an error, a machine
  // surface) still reads naturally in a test.
  return (body.data ?? body) as T
}
