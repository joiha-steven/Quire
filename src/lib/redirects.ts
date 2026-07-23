// User-managed URL redirects (301/302). Rows are resolved in `middleware.ts` so the
// client gets a REAL HTTP redirect (a page-level redirect() under a route that has a
// loading.tsx is downgraded by Next to a 200 meta-refresh). A slug rename auto-adds a
// permanent redirect from the old path (see posts.ts / pages.ts). SERVER-ONLY.

import { db } from '@/lib/db'
import { normalizePath, isValidDestination } from '@/lib/redirect-path'

export type Redirect = {
  id: number
  source: string // normalized request path, e.g. '/old-slug'
  destination: string // path ('/new-slug') or absolute URL
  permanent: boolean // true = 301, false = 302
}

type Row = { id: number; source: string; destination: string; permanent: boolean }

// All redirects, newest first (admin list). Degrades to [] if the DB is unreachable.
export async function getRedirects(): Promise<Redirect[]> {
  try {
    const { data, error } = await db()
      .from('redirects')
      .select('id,source,destination,permanent')
      .order('created_at', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] redirects.getRedirects: ${error.message}`)
      return []
    }
    return data as Row[]
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
  const { error } = await db()
    .from('redirects')
    .upsert({ source, destination, permanent: input.permanent ?? true }, { onConflict: 'source' })
  if (error) throw new Error(`saveRedirect: ${error.message}`)
}

export async function deleteRedirect(id: number): Promise<void> {
  const { error } = await db().from('redirects').delete().eq('id', id)
  if (error) throw new Error(`deleteRedirect: ${error.message}`)
}

// Remove any redirect whose source is this path — called when a post/page becomes
// live at that slug, so live content always wins over a stale redirect (and a
// rename back to an old slug can't leave a self-loop).
export async function clearRedirectForPath(path: string): Promise<void> {
  const source = normalizePath(path)
  if (!source) return
  await db().from('redirects').delete().eq('source', source)
}
