'use client'

// Site settings form: title, description, logo (toggle + picker), show-description.
import { useState } from 'react'
import type { SiteSettings, SiteLang, FeatureSettings, ApiResponse } from '@/types'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ToggleField, ToggleRow } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { MediaLibrary } from './MediaLibrary'
import { useAdminT } from './I18nProvider'

const MENU_FIELD =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400'

// Reader-facing feature toggles (merged in from the former Features tab).
const FEATURES: { key: keyof FeatureSettings; label: string; desc: string }[] = [
  { key: 'search', label: 'Tìm kiếm', desc: 'Icon tìm trên header và trang /search.' },
  { key: 'toc', label: 'Mục lục', desc: 'Khung mục lục bên trái (desktop) cho bài có từ 3 đề mục.' },
  { key: 'related', label: 'Bài viết liên quan', desc: 'Gợi ý bài cùng thẻ/danh mục ở cuối bài.' },
  { key: 'readingTime', label: 'Thời gian đọc', desc: 'Ước tính "X phút đọc" ở dòng thông tin bài.' },
  { key: 'progressBar', label: 'Thanh tiến độ đọc', desc: 'Thanh mảnh trên đầu trang chạy theo khi cuộn.' },
]

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [s, setS] = useState<SiteSettings>(initial)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)

  const update = (partial: Partial<SiteSettings>) => setS((prev) => ({ ...prev, ...partial }))
  const setFeature = (key: keyof FeatureSettings, v: boolean) =>
    setS((prev) => ({ ...prev, features: { ...prev.features, [key]: v } }))

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
      notify(t.savedSettings)
    } catch {
      notify(t.saveFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  const LANGS: { value: SiteLang; label: string }[] = [
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'en', label: 'English' },
  ]

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.siteLanguage}</span>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          {LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => update({ language: l.value })}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                s.language === l.value ? 'bg-white shadow-sm dark:bg-neutral-700' : 'text-neutral-500'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {t.siteLanguageHint}
        </p>
      </div>

      <Input
        label={t.siteTitle}
        value={s.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="vibeblog"
      />

      <Textarea
        label={t.siteDescription}
        rows={2}
        value={s.description}
        onChange={(e) => update({ description: e.target.value })}
        placeholder={t.siteDescriptionPlaceholder}
      />

      <ToggleField
        label={t.showDescription}
        checked={s.showDescription}
        onChange={(v) => update({ showDescription: v })}
      />

      <hr />

      <ToggleField label={t.showLogo} checked={s.showLogo} onChange={(v) => update({ showLogo: v })} />

      {s.showLogo && (
        <div className="space-y-3">
          {/* Fixed-size preview just to confirm which image is selected. */}
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt="Logo" className="h-12 w-auto rounded bg-neutral-100 p-1" />
          ) : (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.noLogo}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setPicking(true)}>
              {t.chooseLogo}
            </Button>
            {s.logoUrl && (
              <Button variant="ghost" type="button" onClick={() => update({ logoUrl: '' })}>
                {t.removeLogo}
              </Button>
            )}
          </div>
          <Input
            label={t.logoWidth}
            type="number"
            min={24}
            max={600}
            value={s.logoWidth}
            onChange={(e) => update({ logoWidth: Number(e.target.value) })}
          />
          <p className="-mt-3 text-xs text-neutral-400 dark:text-neutral-500">
            {t.logoWidthHint}
          </p>
        </div>
      )}

      <hr />

      <Input
        label={t.siteWidth}
        type="number"
        min={360}
        max={1600}
        value={s.contentWidth}
        onChange={(e) => update({ contentWidth: Number(e.target.value) })}
      />
      <p className="-mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        {t.siteWidthHint}
      </p>

      <Input
        label={t.postsPerPage}
        type="number"
        min={1}
        max={100}
        value={s.postsPerPage}
        onChange={(e) => update({ postsPerPage: Number(e.target.value) })}
      />
      <p className="-mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        {t.postsPerPageHint}
      </p>

      <hr />

      <div className="space-y-3">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.menuTitle}</span>
        {s.menu.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item.label}
              onChange={(e) =>
                update({ menu: s.menu.map((m, idx) => (idx === i ? { ...m, label: e.target.value } : m)) })
              }
              placeholder={t.menuLabelField}
              className={MENU_FIELD}
            />
            <input
              value={item.href}
              onChange={(e) =>
                update({ menu: s.menu.map((m, idx) => (idx === i ? { ...m, href: e.target.value } : m)) })
              }
              placeholder={t.menuHrefField}
              className={MENU_FIELD}
            />
            <button
              type="button"
              onClick={() => update({ menu: s.menu.filter((_, idx) => idx !== i) })}
              aria-label={t.delete}
              className="shrink-0 rounded-lg px-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              ×
            </button>
          </div>
        ))}
        <Button variant="secondary" type="button" onClick={() => update({ menu: [...s.menu, { label: '', href: '' }] })}>
          {t.menuAdd}
        </Button>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.menuHint}</p>
      </div>

      <hr />

      <div className="space-y-3">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tính năng đọc</span>
        <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {FEATURES.map((f) => (
            <ToggleRow
              key={f.key}
              label={f.label}
              desc={f.desc}
              checked={s.features[f.key]}
              onChange={(v) => setFeature(f.key, v)}
            />
          ))}
        </div>
      </div>

      <div className="pt-2">
        <Button onClick={save} disabled={saving}>
          {saving ? t.saving : t.saveSettings}
        </Button>
      </div>

      {picking && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            update({ logoUrl: url })
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
