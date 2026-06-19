// Edit an existing static page.
import { notFound } from 'next/navigation'
import { getPage } from '@/lib/pages'
import { PageForm } from '@/components/admin/PageForm'

export const dynamic = 'force-dynamic'

export default async function EditStaticPage({ params }: PageProps<'/admin/page-editor/[slug]'>) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()
  return <PageForm initial={page} />
}
