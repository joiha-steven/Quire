// Admin settings: general settings (incl. reader features), appearance, SEO —
// uniform cards in a two-column layout.
import { getSettings } from '@/lib/settings'
import { THEME_PRESETS } from '@/lib/themes'
import { getCommentEnv } from '@/lib/comment-env'
import { getIntegrationStatus } from '@/lib/integration-keys'
import { SettingsView } from '@/components/admin/SettingsView'


export default async function SettingsPage() {
  const [settings, commentEnv, integrations] = await Promise.all([
    getSettings(),
    getCommentEnv(),
    getIntegrationStatus(),
  ])
  return <SettingsView settings={settings} presets={THEME_PRESETS} commentEnv={commentEnv} integrations={integrations} />
}
