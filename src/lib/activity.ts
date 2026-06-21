// Activity log — a transparent, owner-only record of admin mutations (post/page
// saves + deletes, media/file uploads + deletes, settings, taxonomy, cache clear).
// Stored in the Postgres `activity_log` table. Logging is gated by
// `settings.features.activityLog` (Admin → Settings) so the owner can turn it off.
//
// Never throws: a logging failure must not break the action being logged.

import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'

export type ActivityAction =
  | 'post.create' | 'post.update' | 'post.delete'
  | 'page.create' | 'page.update' | 'page.delete'
  | 'media.upload' | 'media.delete'
  | 'file.add' | 'file.delete' | 'icon.upload' | 'font.upload'
  | 'settings.save' | 'taxonomy.update' | 'cache.clear'

export type ActivityEntry = {
  id: number
  at: string
  action: ActivityAction
  detail: string
}

// Record one action. No-op (silently) when the toggle is off or on any error.
export async function logActivity(action: ActivityAction, detail = ''): Promise<void> {
  try {
    const { features } = await getSettings()
    if (!features.activityLog) return
    await db().from('activity_log').insert({ action, detail: detail.slice(0, 500) })
  } catch (error) {
    console.error(`[ERROR] activity.logActivity(${action}): ${(error as Error).message}`)
  }
}

// Most-recent entries first (default 200). Empty on error.
export async function getActivity(limit = 200): Promise<ActivityEntry[]> {
  try {
    const { data, error } = await db()
      .from('activity_log')
      .select('id, at, action, detail')
      .order('at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as ActivityEntry[]
  } catch (error) {
    console.error(`[ERROR] activity.getActivity: ${(error as Error).message}`)
    return []
  }
}

// Wipe the whole log (owner action from the Log page).
export async function clearActivity(): Promise<void> {
  await db().from('activity_log').delete().neq('id', 0)
}
