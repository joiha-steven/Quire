'use client'

// Settings screen: ONE form, ONE save button, split into three tabs — General,
// Appearance, Advanced. All settings live in a single state object and are saved
// together via PUT /api/settings (which merges). Cards keep uniform chrome; each
// tab lays them out in a top-aligned, length-balanced grid on desktop.
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SiteSettings, ApiResponse } from '@/types'
import type { ThemePreset } from '@/lib/themes'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatTime } from '@/lib/utils'
import { useAdminT } from './I18nProvider'
import { SiteFields } from './SiteFields'
import { ThemeFields } from './ThemeFields'
import { TypographyFields } from './TypographyFields'
import { FontUpload } from './FontUpload'
import { AdvancedFields } from './AdvancedFields'
import { McpFields } from './McpFields'
import { BackupFields } from './BackupFields'
import { LayoutMenuFields } from './LayoutMenuFields'
import { FeatureFields } from './FeatureFields'
import { SeoFields } from './SeoFields'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-base font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

type Tab = 'general' | 'appearance' | 'advanced'

export function SettingsView({ settings, presets }: { settings: SiteSettings; presets: ThemePreset[] }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [s, setS] = useState<SiteSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  // Open the tab named by ?tab= (the Drive-connect redirect lands on advanced);
  // admin is force-dynamic so the param is consistent server/client (no mismatch).
  const tabParam = useSearchParams().get('tab')
  const [tab, setTab] = useState<Tab>(tabParam === 'appearance' || tabParam === 'advanced' ? tabParam : 'general')

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

  const TABS: { id: Tab; label: string }[] = [
    { id: 'general', label: t.tabGeneral },
    { id: 'appearance', label: t.tabAppearance },
    { id: 'advanced', label: t.tabAdvanced },
  ]

  return (
    <div className="pb-24">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.settingsTitle}</h1>

      {/* Tab bar — one shared chip style so the three never drift. */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            aria-pressed={tab === tb.id}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === tb.id
                ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card title={t.cardGeneral}>
              <SiteFields s={s} update={update} />
            </Card>
            <Card title={t.cardLayout}>
              <LayoutMenuFields s={s} update={update} />
            </Card>
          </div>
          <div className="space-y-6">
            <Card title={t.cardFeatures}>
              <FeatureFields
                features={s.features}
                onChange={(features) => update({ features })}
                relatedCount={s.relatedCount}
                onRelatedCount={(relatedCount) => update({ relatedCount })}
              />
            </Card>
            <Card title="SEO">
              <SeoFields s={s} update={update} />
            </Card>
          </div>
        </div>
      )}

      {tab === 'appearance' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card title={t.navAppearance}>
              <ThemeFields
                presets={presets}
                themes={s.themes}
                defaultId={s.themePreset}
                onChangeThemes={(themes) => update({ themes })}
                onSetDefault={(themePreset) => update({ themePreset })}
              />
            </Card>
          </div>
          <div className="space-y-6">
            <Card title={t.cardFont}>
              <FontUpload value={s.customFont} onChange={(customFont) => update({ customFont })} />
            </Card>
            <Card title={t.cardTypography}>
              <TypographyFields typography={s.typography} onChange={(typography) => update({ typography })} />
            </Card>
            <Card title={t.cardRendering}>
              <AdvancedFields typography={s.typography} onTypography={(typography) => update({ typography })} />
            </Card>
          </div>
        </div>
      )}

      {tab === 'advanced' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card title={t.backupTitle}>
            <BackupFields backups={s.backups} onChange={(backups) => update({ backups })} />
          </Card>
          <Card title={t.cardMcp}>
            <McpFields mcp={s.mcp} onChange={(mcp) => update({ mcp })} />
          </Card>
          <Card title={t.customCss}>
            <div className="space-y-1.5">
              <textarea
                value={s.customCss}
                onChange={(e) => update({ customCss: e.target.value })}
                rows={10}
                spellCheck={false}
                placeholder={'.prose h2 { letter-spacing: -0.01em }'}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.customCssHint}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Single, always-reachable save bar. Offset past the sidebar on desktop via
          the --admin-nav-w var the sidebar publishes (adapts to collapse). */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 backdrop-blur md:left-[var(--admin-nav-w,13rem)] dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-[100px]">
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
