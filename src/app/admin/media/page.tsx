// Media library page.
import { getSettings } from '@/lib/settings'
import { adminT } from '@/lib/admin-i18n'
import { MediaLibrary } from '@/components/admin/MediaLibrary'


export default async function MediaPage() {
  const { language } = await getSettings()
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{adminT(language).mediaTitle}</h1>
      </div>
      <MediaLibrary mode="page" />
    </div>
  )
}
