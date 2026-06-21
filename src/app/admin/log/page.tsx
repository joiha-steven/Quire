// Admin Log page: recent admin activity (saves, uploads, deletes…), newest first.
import { getActivity } from '@/lib/activity'
import { getSettings } from '@/lib/settings'
import { ActivityLog } from '@/components/admin/ActivityLog'

export const dynamic = 'force-dynamic'

export default async function AdminLogPage() {
  const [entries, settings] = await Promise.all([getActivity(), getSettings()])
  return <ActivityLog entries={entries} enabled={settings.features.activityLog} />
}
