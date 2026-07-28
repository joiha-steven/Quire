// Edit an existing static page.
import { notFound } from 'next/navigation'
import { getPage } from '@/lib/pages'
import { getSettings } from '@/lib/settings'
import { PageForm } from '@/components/admin/PageForm'


export default async function EditStaticPage({ params }: PageProps<'/admin/page-editor/[slug]'>) {
  const { slug } = await params
  const [page, settings] = await Promise.all([getPage(slug), getSettings()])
  if (!page) notFound()
  return <PageForm initial={page} contentWidth={settings.contentWidth} typewriterEffects={settings.motion.typewriter} />
}
