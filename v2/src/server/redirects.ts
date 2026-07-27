// User-managed URL redirects (301/302). A slug rename auto-adds a permanent redirect
// from the old path (see content/posts.ts and content/pages.ts). SERVER-ONLY.
//
// In the frozen tree these were resolved in Next's `middleware.ts` because a page-level
// redirect() under a route with a loading.tsx was downgraded to a 200 meta-refresh. Hono
// has no such rule: the lookup becomes ordinary middleware in M3, and the rows here do
// not change.

import { normalizePath, isValidDestination } from '@/server/redirect-path'
import { all, run } from '@/store/query'
import { nowMs } from '@/store/db'

export type Redirect = {
  id: number
  source: string // normalized request path, e.g. '/old-slug'
  destination: string // path ('/new-slug') or absolute URL
  permanent: boolean // true = 301, false = 302
}

// SQLite has no boolean: `permanent` is a 0/1 integer, constrained in the schema.
type Row = { id: number; source: string; destination: string; permanent: number }

const toRedirect = (r: Row): Redirect => ({ ...r, permanent: !!r.permanent })

// All redirects, newest first (admin list). Degrades to [] if the DB is unreachable.
export async function getRedirects(): Promise<Redirect[]> {
  try {
    return all<Row>(
      `select id, source, destination, permanent from redirects order by created_at desc`,
    ).map(toRedirect)
  } catch (error) {
    console.error(`[ERROR] redirects.getRedirects: ${(error as Error).message}`)
    return []
  }
}

export class RedirectInputError extends Error {}

// Create/replace a redirect (upsert by source). Normalizes + validates; a self-
// redirect (source === destination) is rejected as a no-op loop.
export async function saveRedirect(input: {
  source: string
  destination: string
  permanent?: boolean
}): Promise<void> {
  const source = normalizePath(input.source)
  const destination = input.destination.trim().startsWith('/')
    ? normalizePath(input.destination)
    : input.destination.trim()
  if (!source) throw new RedirectInputError('A source path is required')
  if (!isValidDestination(destination)) throw new RedirectInputError('Destination must be a path or an http(s) URL')
  if (source === destination) throw new RedirectInputError('Source and destination are the same')
  run(
    `insert into redirects (source, destination, permanent, created_at)
     values ($source, $destination, $permanent, $now)
     on conflict(source) do update set
       destination = excluded.destination,
       permanent   = excluded.permanent`,
    {
      source: source,
      destination: destination,
      permanent: (input.permanent ?? true) ? 1 : 0,
      now: nowMs(),
    },
  )
}

export async function deleteRedirect(id: number): Promise<void> {
  run(`delete from redirects where id = ?`, id)
}

// Remove any redirect whose source is this path — called when a post/page becomes
// live at that slug, so live content always wins over a stale redirect (and a
// rename back to an old slug can't leave a self-loop).
export async function clearRedirectForPath(path: string): Promise<void> {
  const source = normalizePath(path)
  if (!source) return
  run(`delete from redirects where source = ?`, source)
}
