'use client'

// Two-tab shell for the Library page: "Images" (the media library) and "Files"
// (non-image attachments). Each tab mounts lazily on first open.
import { useState } from 'react'
import { MediaLibrary } from './MediaLibrary'
import { FileLibrary } from './FileLibrary'
import { useAdminT } from './I18nProvider'

type Tab = 'images' | 'files'

export function LibraryTabs() {
  const t = useAdminT()
  const [tab, setTab] = useState<Tab>('images')

  const tabClass = (active: boolean) =>
    `border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
      active
        ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
        : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
    }`

  return (
    <div>
      <div className="mb-6 flex gap-6 border-b border-neutral-200 dark:border-neutral-800">
        <button type="button" onClick={() => setTab('images')} className={tabClass(tab === 'images')}>
          {t.tabImages}
        </button>
        <button type="button" onClick={() => setTab('files')} className={tabClass(tab === 'files')}>
          {t.tabFiles}
        </button>
      </div>
      {/* Keep the images tab mounted (it holds upload/scroll state); only the
          files tab is created on first visit. */}
      <div className={tab === 'images' ? '' : 'hidden'}>
        <MediaLibrary mode="page" />
      </div>
      {tab === 'files' && <FileLibrary />}
    </div>
  )
}
