'use client'

// Three-tab shell for the Library page: "Images" (the media library), "Videos"
// (video attachments with players), and "Files" (the other attachments). The
// non-default tabs mount lazily on first open.
import { useState } from 'react'
import { MediaLibrary } from './MediaLibrary'
import { VideoLibrary } from './VideoLibrary'
import { FileLibrary } from './FileLibrary'
import { useAdminT } from './I18nProvider'

type Tab = 'images' | 'videos' | 'files'

export function LibraryTabs() {
  const t = useAdminT()
  const [tab, setTab] = useState<Tab>('images')

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-white text-neutral-950 shadow-sm dark:bg-neutral-700 dark:text-white'
        : 'text-neutral-500 hover:bg-white/60 hover:text-neutral-800 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200'
    }`

  return (
    <div>
      <div className="mb-6 flex w-fit gap-1 rounded-xl bg-neutral-200/70 p-1 dark:bg-neutral-800">
        <button type="button" onClick={() => setTab('images')} className={tabClass(tab === 'images')}>
          {t.tabImages}
        </button>
        <button type="button" onClick={() => setTab('videos')} className={tabClass(tab === 'videos')}>
          {t.tabVideos}
        </button>
        <button type="button" onClick={() => setTab('files')} className={tabClass(tab === 'files')}>
          {t.tabFiles}
        </button>
      </div>
      {/* Keep the images tab mounted (it holds upload/scroll state); the videos and
          files tabs are created on first visit. */}
      <div className={tab === 'images' ? '' : 'hidden'}>
        <MediaLibrary mode="page" />
      </div>
      {tab === 'videos' && <VideoLibrary />}
      {tab === 'files' && <FileLibrary />}
    </div>
  )
}
