// Trash: soft-deleted posts, pages, media and files — each kind in its own tab.
// Items live here until restored or permanently removed; nothing auto-purges.
import { getTrashedPosts } from '@/lib/posts'
import { getTrashedPages } from '@/lib/pages'
import { getTrashedMedia } from '@/lib/media'
import { getTrashedFiles } from '@/lib/files'
import { TrashView } from '@/components/admin/TrashView'

export default async function AdminTrash() {
  const [posts, pages, media, files] = await Promise.all([
    getTrashedPosts(),
    getTrashedPages(),
    getTrashedMedia(),
    getTrashedFiles(),
  ])
  return <TrashView posts={posts} pages={pages} media={media} files={files} />
}
