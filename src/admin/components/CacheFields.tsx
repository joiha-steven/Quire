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
import { PANEL } from './kit'

export function CacheFields(
  { cache, onChange }: { cache: CacheSettings; onChange: (c: CacheSettings) => void },
) {
  const t = useAdminT()
  return (
    <div className="space-y-3">
      <div className={PANEL}>
        <ToggleRow
          label={t.cacheEnable}
          desc={t.cacheEnableDesc}
          checked={cache.enabled}
          onChange={(enabled) => onChange({ ...cache, enabled })}
        />
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.cacheClearDesc}</p>
      <CacheButton className="inline-flex items-center gap-2 border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800" />
    </div>
  )
}
