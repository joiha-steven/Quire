// Appearance settings: per-mode reading colors.
import { getSettings, DEFAULT_THEME } from '@/lib/settings'
import { AppearanceForm } from '@/components/admin/AppearanceForm'

export const dynamic = 'force-dynamic'

export default async function AppearancePage() {
  const { theme } = await getSettings()
  return <AppearanceForm initial={theme} defaults={DEFAULT_THEME} />
}
