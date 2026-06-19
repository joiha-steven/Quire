// Media library page.
import { MediaLibrary } from '@/components/admin/MediaLibrary'

export default function MediaPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Thư viện ảnh</h1>
      </div>
      <MediaLibrary mode="page" />
    </div>
  )
}
