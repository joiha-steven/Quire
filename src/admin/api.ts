// The one way the admin talks to the server.
//
// In the frozen tree each admin page was a server component that called `getIndex()` or
// `getAnalytics()` directly and passed the result down as props. There is no server render
// here, so every one of those reads becomes a fetch — and rather than scatter them, each
// page has ONE endpoint under `/api/admin/view/` returning exactly the props its component
// tree already expects. The component tree is therefore unchanged, which is the whole
// point: the port moved the data source, not the components.
//
// The mutating endpoints are the same `/api/*` routes the frozen tree's client components
// already posted to, so those call sites moved verbatim.

/** The envelope every API route in this codebase answers with. */
type Envelope<T> = { success?: boolean; data?: T; error?: string }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  // A 401 means the session went away while the tab was open. Sending the reader back to
  // the sign-in page is the only useful answer, and it beats a toast saying "unauthorized"
  // over an admin that no longer works.
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
    throw new ApiError('signed out', 401)
  }
  const body = await res.json().catch(() => ({})) as Envelope<T>
  if (!res.ok || body.error) throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status)
  return (body.data ?? body) as T
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) }),
}

/** The props for one admin view, fetched in a single round trip. */
export const view = <T>(name: string, query = '') =>
  request<T>(`/api/admin/view/${name}${query}`)
