'use client'

// Settings screen: uniform-width cards in a balanced two-column layout on
// desktop (single column on mobile). The former "Features" tab is merged into
// the general settings card. Each card saves independently via /api/settings.
import type { SiteSettings, ThemeSettings } from '@/types'
import { SettingsForm } from './SettingsForm'
import { AppearanceForm } from './AppearanceForm'
import { SeoForm } from './SeoForm'
import { useAdminT } from './I18nProvider'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-base font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

export function SettingsView({ settings, defaultTheme }: { settings: SiteSettings; defaultTheme: ThemeSettings }) {
  const t = useAdminT()
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.settingsTitle}</h1>

      {/* Multi-column keeps every card the same width and flows the uneven
          heights into two balanced columns on desktop. */}
      <div className="gap-6 lg:columns-2">
        <Card title="Cài đặt chung">
          <SettingsForm initial={settings} />
        </Card>
        <Card title={t.navAppearance}>
          <AppearanceForm initial={settings.theme} defaults={defaultTheme} />
        </Card>
        <Card title="SEO">
          <SeoForm initial={settings} />
        </Card>
      </div>
    </div>
  )
}
