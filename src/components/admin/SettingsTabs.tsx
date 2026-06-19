'use client'

// Settings screen with two tabs: site settings and appearance (theme colors).
import { useState } from 'react'
import type { SiteSettings, ThemeSettings } from '@/types'
import { SettingsForm } from './SettingsForm'
import { AppearanceForm } from './AppearanceForm'
import { useAdminT } from './I18nProvider'

type Tab = 'site' | 'appearance'

export function SettingsTabs({ settings, defaultTheme }: { settings: SiteSettings; defaultTheme: ThemeSettings }) {
  const t = useAdminT()
  const [tab, setTab] = useState<Tab>('site')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'site', label: t.navSettings },
    { key: 'appearance', label: t.navAppearance },
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

      {tab === 'site' ? (
        <SettingsForm initial={settings} />
      ) : (
        <AppearanceForm initial={settings.theme} defaults={defaultTheme} />
      )}
    </div>
  )
}
