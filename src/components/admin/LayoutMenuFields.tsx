'use client'

// Controlled layout + header-menu fields. Parent owns state + save.
import type { SiteSettings } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAdminT } from './I18nProvider'

const MENU_FIELD =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400'

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

export function LayoutMenuFields({ s, update }: Props) {
  const t = useAdminT()

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Input
          label={t.siteWidth}
          type="number"
          min={360}
          max={1600}
          value={s.contentWidth}
          onChange={(e) => update({ contentWidth: Number(e.target.value) })}
        />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.siteWidthHint}</p>
      </div>

      <div className="space-y-1.5">
        <Input
          label={t.postsPerPage}
          type="number"
          min={1}
          max={100}
          value={s.postsPerPage}
          onChange={(e) => update({ postsPerPage: Number(e.target.value) })}
        />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.postsPerPageHint}</p>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.menuTitle}</span>
        {s.menu.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item.label}
              onChange={(e) => update({ menu: s.menu.map((m, idx) => (idx === i ? { ...m, label: e.target.value } : m)) })}
              placeholder={t.menuLabelField}
              className={MENU_FIELD}
            />
            <input
              value={item.href}
              onChange={(e) => update({ menu: s.menu.map((m, idx) => (idx === i ? { ...m, href: e.target.value } : m)) })}
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
    </div>
  )
}
