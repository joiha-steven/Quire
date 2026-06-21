'use client'

// Settings screen: ONE form, ONE save button. All settings live in a single
// state object and are saved together via PUT /api/settings (which merges).
// Layout = two top-aligned, length-balanced columns of equal-width cards on
// desktop; one column on mobile.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SiteSettings, ApiResponse } from '@/types'
import type { ThemePreset } from '@/lib/themes'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatTime } from '@/lib/utils'
import { useAdminT } from './I18nProvider'
import { SiteFields } from './SiteFields'
import { ThemeFields } from './ThemeFields'
import { TypographyFields } from './TypographyFields'
import { LayoutMenuFields } from './LayoutMenuFields'
import { FeatureFields } from './FeatureFields'
import { SeoFields } from './SeoFields'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-base font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

export function SettingsView({ settings, presets }: { settings: SiteSettings; presets: ThemePreset[] }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [s, setS] = useState<SiteSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const update = (partial: Partial<SiteSettings>) => setS((prev) => ({ ...prev, ...partial }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      const json = (await res.json()) as ApiResponse<SiteSettings>
      if (!json.success) throw new Error(json.error)
      setSavedAt(new Date().toISOString())
      notify(t.savedSettings)
      // Re-render server components (admin shell language/labels, public header)
      // with the freshly-saved settings so the change shows immediately.
      router.refresh()
    } catch {
      notify(t.saveFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-24">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.settingsTitle}</h1>

      {/* Two explicit columns: both start at the top, sections distributed so the
          two columns end up roughly the same length. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title={t.cardGeneral}>
            <SiteFields s={s} update={update} />
          </Card>
          <Card title={t.cardLayout}>
            <LayoutMenuFields s={s} update={update} />
          </Card>
          <Card title={t.cardFeatures}>
            <FeatureFields
              features={s.features}
              onChange={(features) => update({ features })}
              relatedCount={s.relatedCount}
              onRelatedCount={(relatedCount) => update({ relatedCount })}
            />
          </Card>
          <Card title={t.cardTypography}>
            <TypographyFields typography={s.typography} onChange={(typography) => update({ typography })} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={t.navAppearance}>
            <ThemeFields
              presets={presets}
              themes={s.themes}
              defaultId={s.themePreset}
              onChangeThemes={(themes) => update({ themes })}
              onSetDefault={(themePreset) => update({ themePreset })}
              customCss={s.customCss}
              onCustomCss={(customCss) => update({ customCss })}
            />
          </Card>
          <Card title="SEO">
            <SeoFields s={s} update={update} />
          </Card>
        </div>
      </div>

      {/* Single, always-reachable save bar. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <span className="text-sm text-neutral-400 dark:text-neutral-500">
            {saving ? t.saving : savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''}
          </span>
          <Button onClick={save} disabled={saving}>
            {saving ? t.saving : t.saveSettings}
          </Button>
        </div>
      </div>
    </div>
  )
}
