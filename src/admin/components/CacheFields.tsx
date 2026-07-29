// The cache switch (Settings -> System), plus the manual purge that was already in the
// sidebar.
//
// One switch, two layers: the page cache inside this process and what a shared cache in
// front of it is allowed to do. They move together because separating them is a trap —
// turning off only the in-process cache leaves Cloudflare answering with the copy you are
// trying to get rid of, and the switch looks broken from outside.

import type { CacheSettings } from '@/types'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { CacheButton } from './CacheButton'
import { PANEL, Setting, SETTING_GAP } from './kit'

/** The button chrome of `ui/Button`'s secondary variant. CacheButton takes a class, not a variant. */
const CLEAR_BUTTON =
  'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'

export function CacheFields(
  { cache, onChange }: { cache: CacheSettings; onChange: (c: CacheSettings) => void },
) {
  const t = useAdminT()
  return (
    <div className={SETTING_GAP}>
      <div className={PANEL}>
        <ToggleRow
          label={t.cacheEnable}
          desc={t.cacheEnableDesc}
          checked={cache.enabled}
          onChange={(enabled) => onChange({ ...cache, enabled })}
        />
      </div>
      <Setting label={t.clearCache} note={t.cacheClearDesc}>
        <CacheButton className={CLEAR_BUTTON} />
      </Setting>
    </div>
  )
}
