// POST /api/media/delete -> move MANY media items to the Trash (soft delete, owner
// only). Body: { urls: string[] }. Used for "delete all unused" and any multi-
// delete. Soft delete KEEPS every blob, so a published post linking these images
// keeps rendering (no public cache purge needed) — permanent removal happens only
// on Trash purge. Returns the authoritative live list (trashed images excluded).

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { deleteMediaBatch } from '@/lib/media'
import { logActivity } from '@/lib/activity'
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
    const items = await deleteMediaBatch(urls) // authoritative live list (trashed excluded)
    after(() => logActivity('media.delete', `${urls.length} image(s)`))
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete media', 500)
  }
}
