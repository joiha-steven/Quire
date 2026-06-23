// Library page: two tabs — Images (media library) and Files (attachments).
import { getSettings } from '@/lib/settings'
import { adminT } from '@/lib/admin-i18n'
import { LibraryTabs } from '@/components/admin/LibraryTabs'
import { PageHeader } from '@/components/admin/kit'


export default async function MediaPage() {
  const { language } = await getSettings()
  const t = adminT(language)
  return (
    <div>
      <PageHeader title={t.libraryTitle} description={t.libraryIntro} />
      <LibraryTabs />
    </div>
  )
}
