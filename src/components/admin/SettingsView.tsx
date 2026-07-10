'use client'

// Settings screen: ONE form, ONE save button, split into FIVE task-based tabs —
// Site, Content, Appearance, SEO, Integrations. All settings live in a single state
// object and are saved together via PUT /api/settings (which merges). Cards share
// the kit chrome; each tab lays them out in a top-aligned, length-balanced grid.
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SiteSettings, ApiResponse } from '@/types'
import type { ThemePreset } from '@/lib/themes'
import type { CommentEnv } from '@/lib/comment-env'
import type { IntegrationStatus } from '@/lib/integration-keys'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatTime } from '@/lib/utils'
import { Card, PageHeader, Tabs, type TabItem } from './kit'
import { useAdminT } from './I18nProvider'
import { SiteFields } from './SiteFields'
import { ThemeFields } from './ThemeFields'
import { TypographyFields } from './TypographyFields'
import { FontUpload } from './FontUpload'
import { FontFields } from './FontFields'
import { AdvancedFields } from './AdvancedFields'
import { McpFields } from './McpFields'
import { BackupFields } from './BackupFields'
import { LayoutMenuFields } from './LayoutMenuFields'
import { FooterField } from './FooterField'
import { FeatureFields } from './FeatureFields'
import { CommentFields } from './CommentFields'
import { CommentKeys } from './CommentKeys'
import { CloudflareFields } from './CloudflareFields'
import { ImportFields } from './ImportFields'
import { SeoFields } from './SeoFields'

type Tab = 'site' | 'content' | 'appearance' | 'seo' | 'integrations'
const TAB_IDS: Tab[] = ['site', 'content', 'appearance', 'seo', 'integrations']

export function SettingsView({ settings, presets, commentEnv, integrations }: { settings: SiteSettings; presets: ThemePreset[]; commentEnv: CommentEnv; integrations: IntegrationStatus }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [s, setS] = useState<SiteSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  // Open the tab named by ?tab= (the Drive-connect redirect lands on integrations);
  // admin is force-dynamic so the param is consistent server/client (no mismatch).
  const tabParam = useSearchParams().get('tab')
  const [tab, setTab] = useState<Tab>((TAB_IDS as string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'site')

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

  const TABS: TabItem<Tab>[] = [
    { key: 'site', label: t.tabSite },
    { key: 'content', label: t.tabContent },
    { key: 'appearance', label: t.tabAppearance },
    { key: 'seo', label: t.tabSeo },
    { key: 'integrations', label: t.tabIntegrations },
  ]

  return (
    <div className="pb-24">
      <PageHeader title={t.settingsTitle} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} variant="underline" className="mb-6" />

      {/* Site: identity + navigation/layout. */}
      {tab === 'site' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card title={t.cardGeneral}>
            <SiteFields s={s} update={update} />
          </Card>
          <Card title={t.cardLayout}>
            <LayoutMenuFields s={s} update={update} />
            <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.footerContent}</span>
              <FooterField value={s.footer} onChange={(footer) => update({ footer })} />
            </div>
          </Card>
        </div>
      )}

      {/* Content: reading features + reader comments. */}
      {tab === 'content' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card title={t.cardFeatures}>
            <FeatureFields
              features={s.features}
              onChange={(features) => update({ features })}
              relatedCount={s.relatedCount}
              onRelatedCount={(relatedCount) => update({ relatedCount })}
            />
          </Card>
          <Card title={t.cardComments}>
            <CommentFields comments={s.comments} env={commentEnv} onChange={(comments) => update({ comments })} />
            <CommentKeys comments={s.comments} env={commentEnv} />
          </Card>
        </div>
      )}

      {/* Appearance: theme colours, font, type scale, rendering, custom CSS. */}
      {tab === 'appearance' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card title={t.navAppearance}>
              {/* Palette selection now lives on the PUBLIC site only — the admin
                  chrome just toggles light/dark. This sets the site's default + which
                  palettes readers can switch between. */}
              <p className="mb-4 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400">
                {t.themeAdminNote}
              </p>
              <ThemeFields
                presets={presets}
                themes={s.themes}
                defaultId={s.themePreset}
                enabled={s.enabledPalettes}
                onChangeThemes={(themes) => update({ themes })}
                onSetDefault={(themePreset) => update({ themePreset })}
                onChangeEnabled={(enabledPalettes) => update({ enabledPalettes })}
              />
            </Card>
          </div>
          <div className="space-y-6">
            <Card title={t.cardFont}>
              <FontFields
                value={s.fontPreset}
                onChange={(fontPreset, typography) => update({ fontPreset, typography })}
              />
              <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <FontUpload value={s.customFont} onChange={(customFont) => update({ customFont })} />
              </div>
            </Card>
            <Card title={t.cardTypography}>
              <TypographyFields typography={s.typography} onChange={(typography) => update({ typography })} />
            </Card>
            <Card title={t.cardRendering}>
              <AdvancedFields
                typography={s.typography}
                onTypography={(typography) => update({ typography })}
                motion={s.motion}
                onMotion={(motion) => update({ motion })}
              />
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
        </div>
      )}

      {/* SEO: search + social metadata. */}
      {tab === 'seo' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card title="SEO">
            <SeoFields s={s} update={update} />
          </Card>
        </div>
      )}

      {/* Integrations: Google Drive backups + MCP server + Cloudflare cache purge. */}
      {tab === 'integrations' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card title={t.backupTitle}>
            <BackupFields backups={s.backups} onChange={(backups) => update({ backups })} />
          </Card>
          <Card title={t.cardMcp}>
            <McpFields mcp={s.mcp} onChange={(mcp) => update({ mcp })} />
          </Card>
          <Card title={t.cardCloudflare}>
            <CloudflareFields configured={integrations.cloudflareConfigured} zoneId={integrations.cloudflareZoneId} />
          </Card>
          <Card title={t.cardImport}>
            <ImportFields />
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
