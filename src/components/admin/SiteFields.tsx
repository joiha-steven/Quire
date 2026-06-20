'use client'

// Controlled site-info fields (language, title, description, logo). No local
// settings state and no save button — the parent SettingsView owns both.
import { useState } from 'react'
import type { SiteSettings } from '@/types'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ToggleField } from '@/components/ui/Switch'
import { SITE_LANGS } from '@/locales/langs'
import { MediaLibrary } from './MediaLibrary'
import { useAdminT, useSetAdminLang } from './I18nProvider'

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

export function SiteFields({ s, update }: Props) {
  const t = useAdminT()
  const setLang = useSetAdminLang()
  const [picking, setPicking] = useState(false)
  const [pickingFav, setPickingFav] = useState(false)
  const [pickingApp, setPickingApp] = useState(false)

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.siteLanguage}</span>
        <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          {SITE_LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => {
                update({ language: l.value })
                setLang(l.value) // switch the admin UI instantly
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                s.language === l.value ? 'bg-white shadow-sm dark:bg-neutral-700' : 'text-neutral-500'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.siteLanguageHint}</p>
      </div>

      <Input label={t.siteTitle} value={s.title} onChange={(e) => update({ title: e.target.value })} placeholder="vibeblog" />

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
            <Button variant="secondary" type="button" onClick={() => setPicking(true)}>{t.chooseLogo}</Button>
            {s.logoUrl && (
              <Button variant="ghost" type="button" onClick={() => update({ logoUrl: '' })}>{t.removeLogo}</Button>
            )}
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
        <div className="flex items-center gap-3">
          {s.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.faviconUrl} alt="Favicon" className="h-8 w-8 rounded bg-neutral-100 object-contain p-1" />
          ) : (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">{t.noImageSelected}</span>
          )}
          <Button variant="secondary" type="button" onClick={() => setPickingFav(true)}>{t.chooseImage}</Button>
          {s.faviconUrl && (
            <Button variant="ghost" type="button" onClick={() => update({ faviconUrl: '' })}>{t.removeSelection}</Button>
          )}
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.faviconHint}</p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.appIcon}</span>
        <div className="flex items-center gap-3">
          {s.appIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.appIconUrl} alt="App icon" className="h-12 w-12 rounded-xl bg-neutral-100 object-contain p-1" />
          ) : (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">{t.noImageSelected}</span>
          )}
          <Button variant="secondary" type="button" onClick={() => setPickingApp(true)}>{t.chooseImage}</Button>
          {s.appIconUrl && (
            <Button variant="ghost" type="button" onClick={() => update({ appIconUrl: '' })}>{t.removeSelection}</Button>
          )}
        </div>
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
            update({ logoUrl: url })
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {pickingFav && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            update({ faviconUrl: url })
            setPickingFav(false)
          }}
          onClose={() => setPickingFav(false)}
        />
      )}
      {pickingApp && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            update({ appIconUrl: url })
            setPickingApp(false)
          }}
          onClose={() => setPickingApp(false)}
        />
      )}
    </div>
  )
}
