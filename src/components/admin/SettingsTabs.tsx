'use client'

// Settings screen with three tabs: site settings, appearance (theme), and SEO.
import { useState } from 'react'
import type { SiteSettings, ThemeSettings } from '@/types'
import { SettingsForm } from './SettingsForm'
import { AppearanceForm } from './AppearanceForm'
import { SeoForm } from './SeoForm'
import { FeaturesForm } from './FeaturesForm'
import { useAdminT } from './I18nProvider'

type Tab = 'site' | 'appearance' | 'features' | 'seo'

export function SettingsTabs({ settings, defaultTheme }: { settings: SiteSettings; defaultTheme: ThemeSettings }) {
  const t = useAdminT()
  const [tab, setTab] = useState<Tab>('site')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'site', label: t.navSettings },
    { key: 'appearance', label: t.navAppearance },
    { key: 'features', label: 'Tính năng' },
    { key: 'seo', label: 'SEO' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.settingsTitle}</h1>

      <div className="mb-6 flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800 w-fit">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === item.key
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'site' && <SettingsForm initial={settings} />}
      {tab === 'appearance' && <AppearanceForm initial={settings.theme} defaults={defaultTheme} />}
      {tab === 'features' && <FeaturesForm initial={settings} />}
      {tab === 'seo' && <SeoForm initial={settings} />}
    </div>
  )
}
