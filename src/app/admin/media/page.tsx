// Library page: two tabs — Images (media library) and Files (attachments).
import { getSettings } from '@/lib/settings'
import { adminT } from '@/lib/admin-i18n'
import { LibraryTabs } from '@/components/admin/LibraryTabs'


export default async function MediaPage() {
  const { language } = await getSettings()
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{adminT(language).libraryTitle}</h1>
      </div>
      <LibraryTabs />
    </div>
  )
}
