// POST /api/media/delete -> delete MANY media items in one atomic manifest write
// (owner only). Body: { urls: string[] }. Use this for "delete all unused" and
// any multi-delete so concurrent single-deletes can't clobber each other's
// manifest write (lost-update race). Returns the authoritative post-delete list.

import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { deleteMediaBatch } from '@/lib/media'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const maxDuration = 60 // a large unused-sweep may delete many blobs

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { urls?: unknown }
    const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string') : []
    if (urls.length === 0) {
      logRequest(req, 400, start)
      return fail('No urls provided', 400)
    }
    const items = await deleteMediaBatch(urls) // authoritative post-delete list
    revalidatePath('/', 'layout') // a deleted image may appear on a cached page
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete media', 500)
  }
}
