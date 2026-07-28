// Controlled site-info fields (language, title, description, logo). No local
// settings state and no save button — the parent SettingsView owns both.
import { useState } from 'react'
import type { SiteSettings } from '@/types'
import { Input, Textarea } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { ToggleField } from '@/admin/ui/Switch'
import { SITE_LANGS } from '@/locales/langs'
import { MediaLibrary } from './MediaLibrary'
import { IconUpload } from './IconUpload'
import { useAdminT, useSetAdminLang } from './I18nProvider'

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

export function SiteFields({ s, update }: Props) {
  const t = useAdminT()
  const setLang = useSetAdminLang()
  // Which logo slot the media picker is filling. One picker, two targets.
  const [picking, setPicking] = useState<'light' | 'dark' | null>(null)

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.siteLanguage}</span>
        <div className="flex flex-wrap gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
          {SITE_LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => {
                update({ language: l.value })
                setLang(l.value) // switch the admin UI instantly
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                s.language === l.value ? 'bg-white shadow-sm dark:bg-neutral-700' : 'text-neutral-500'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.siteLanguageHint}</p>
      </div>

      <Input label={t.siteTitle} value={s.title} onChange={(e) => update({ title: e.target.value })} placeholder="Quire Blog" />

      <Textarea
        label={t.siteDescription}
        rows={2}
        value={s.description}
        onChange={(e) => update({ description: e.target.value })}
        placeholder={t.siteDescriptionPlaceholder}
      />

      <ToggleField label={t.showDescription} checked={s.showDescription} onChange={(v) => update({ showDescription: v })} />

      <ToggleField label={t.showLogo} checked={s.showLogo} onChange={(v) => update({ showLogo: v })} />

      {s.showLogo && (
        <div className="space-y-3">
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt="Logo" className="h-12 w-auto rounded bg-neutral-100 p-1" />
          ) : (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.noLogo}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setPicking('light')}>{t.chooseLogo}</Button>
            {s.logoUrl && (
              <Button variant="ghost" type="button" onClick={() => update({ logoUrl: '' })}>{t.removeLogo}</Button>
            )}
          </div>

          {/* The dark twin. Optional: with none set, the light mark is used in both modes,
              which is what every install did before this existed. The preview sits on a
              dark tile because that is the only background it will ever be seen on. */}
          <div className="space-y-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            {s.logoDarkUrl ? (
              <img src={s.logoDarkUrl} alt="Logo (dark)" className="h-12 w-auto rounded bg-neutral-900 p-1" />
            ) : (
              <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.noLogoDark}</p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setPicking('dark')}>{t.chooseLogoDark}</Button>
              {s.logoDarkUrl && (
                <Button variant="ghost" type="button" onClick={() => update({ logoDarkUrl: '' })}>{t.removeLogo}</Button>
              )}
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.logoDarkHint}</p>
          </div>

          <div className="space-y-1.5">
            <Input
              label={t.logoWidth}
              type="number"
              min={24}
              max={600}
              value={s.logoWidth}
              onChange={(e) => update({ logoWidth: Number(e.target.value) })}
            />
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.logoWidthHint}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.favicon}</span>
        <IconUpload kind="favicon" value={s.faviconUrl} onChange={(faviconUrl) => update({ faviconUrl })} previewClassName="h-8 w-8 rounded" />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.faviconHint}</p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.appIcon}</span>
        <IconUpload kind="app-icon" value={s.appIconUrl} onChange={(appIconUrl) => update({ appIconUrl })} previewClassName="h-12 w-12 rounded-xl" />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.appIconHint}</p>
      </div>

      <div className="space-y-1.5">
        <Input
          label={t.excerptLength}
          type="number"
          min={10}
          max={100}
          value={s.excerptLength}
          onChange={(e) => update({ excerptLength: Number(e.target.value) })}
        />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.excerptLengthHint}</p>
      </div>

      {picking && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            update(picking === 'dark' ? { logoDarkUrl: url } : { logoUrl: url })
            setPicking(null)
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}
