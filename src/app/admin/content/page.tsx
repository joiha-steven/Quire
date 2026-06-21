// Content list: posts + pages, tabbed. Carries all-time view totals per path so
// each table can show a View column.
import { getIndex } from '@/lib/posts'
import { getPageIndex } from '@/lib/pages'
import { getViewTotals } from '@/lib/analytics'
import { ContentDashboard } from '@/components/admin/ContentDashboard'


export default async function AdminContent() {
  const [posts, pages, views] = await Promise.all([getIndex(), getPageIndex(), getViewTotals()])
  return <ContentDashboard posts={posts} pages={pages} views={views} />
}
