// Admin settings: general settings (incl. reader features), appearance, SEO —
// uniform cards in a two-column layout.
import { getSettings, DEFAULT_THEME } from '@/lib/settings'
import { SettingsView } from '@/components/admin/SettingsView'


export default async function SettingsPage() {
  const settings = await getSettings()
  return <SettingsView settings={settings} defaultTheme={DEFAULT_THEME} />
}
