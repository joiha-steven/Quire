// Admin settings: general settings (incl. reader features), appearance, SEO —
// uniform cards in a two-column layout.
import { getSettings } from '@/lib/settings'
import { THEME_PRESETS } from '@/lib/themes'
import { getCommentEnv } from '@/lib/comment-env'
import { SettingsView } from '@/components/admin/SettingsView'


export default async function SettingsPage() {
  const settings = await getSettings()
  return <SettingsView settings={settings} presets={THEME_PRESETS} commentEnv={getCommentEnv()} />
}
