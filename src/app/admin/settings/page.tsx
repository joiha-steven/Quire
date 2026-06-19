// Admin settings page.
import { getSettings } from '@/lib/settings'
import { adminT } from '@/lib/admin-i18n'
import { SettingsForm } from '@/components/admin/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const settings = await getSettings()
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{adminT(settings.language).settingsTitle}</h1>
      <SettingsForm initial={settings} />
    </div>
  )
}
