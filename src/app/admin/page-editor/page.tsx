// New page.
import { getSettings } from '@/lib/settings'
import { PageForm } from '@/components/admin/PageForm'


export default async function NewStaticPage() {
  const settings = await getSettings()
  return <PageForm contentWidth={settings.contentWidth} />
}
