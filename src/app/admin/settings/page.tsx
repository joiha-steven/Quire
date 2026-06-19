// Admin settings: site settings + appearance, tabbed.
import { getSettings, DEFAULT_THEME } from '@/lib/settings'
import { SettingsTabs } from '@/components/admin/SettingsTabs'


export default async function SettingsPage() {
  const settings = await getSettings()
  return <SettingsTabs settings={settings} defaultTheme={DEFAULT_THEME} />
}
