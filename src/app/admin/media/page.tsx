// Library page: two tabs — Images (media library) and Files (attachments).
import { getSettings } from '@/lib/settings'
import { adminT } from '@/lib/admin-i18n'
import { LibraryTabs } from '@/components/admin/LibraryTabs'


export default async function MediaPage() {
  const { language } = await getSettings()
  const t = adminT(language)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.libraryTitle}</h1>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">{t.libraryIntro}</p>
      <LibraryTabs />
    </div>
  )
}
