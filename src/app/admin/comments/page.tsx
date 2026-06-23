// Admin Comments page: every live comment, newest first, with one-click delete
// (soft delete -> Trash). Reads live (the /admin layout forces no-store).
import { getAdminComments } from '@/lib/comments'
import { CommentsTable } from '@/components/admin/CommentsTable'

export const dynamic = 'force-dynamic'

export default async function AdminCommentsPage() {
  const { rows } = await getAdminComments(1, 200)
  return <CommentsTable initial={rows} />
}
