// Content list: posts + pages, tabbed.
import { getIndex } from '@/lib/posts'
import { getPageIndex } from '@/lib/pages'
import { ContentDashboard } from '@/components/admin/ContentDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminContent() {
  const [posts, pages] = await Promise.all([getIndex(), getPageIndex()])
  return <ContentDashboard posts={posts} pages={pages} />
}
