// Pure path helpers for the redirect subsystem. NO imports — safe to use from the
// edge middleware (which must never pull in the node-only `db`/supabase-js bundle)
// AND from the server-side data layer (`redirects.ts`).

// Normalize a request path for storage + lookup: force a single leading slash, drop
// any query/hash, collapse duplicate slashes, and strip a trailing slash (except the
// root). Returns '' if the input can't be made into a rooted path.
export function normalizePath(input: string): string {
  let p = (input ?? '').trim()
  if (!p) return ''
  p = p.split('#')[0].split('?')[0]
  if (!p.startsWith('/')) p = `/${p}`
  p = p.replace(/\/+/g, '/') // collapse duplicate slashes
  if (p.length > 1) p = p.replace(/\/$/, '') // drop trailing slash (keep root '/')
  return p
}

// A destination is valid if it is a rooted path or an absolute http(s) URL.
export function isValidDestination(dest: string): boolean {
  const d = (dest ?? '').trim()
  if (d.startsWith('/')) return d.length > 1 || d === '/'
  return /^https?:\/\/\S+$/i.test(d)
}
