'use client'

// Right-hand settings panel of the editor screen.
import type { PostStatus, ImageDisplay } from '@/types'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { MultiSelect } from './MultiSelect'

export type Draft = {
  title: string
  slug: string
  date: string // datetime-local value (local time, no zone)
  status: PostStatus
  categories: string[]
  tags: string[]
  featuredImage: string
  imageDisplay: ImageDisplay
  excerpt: string
  content: string
}

type Props = {
  draft: Draft
  update: (partial: Partial<Draft>) => void
  allCategories: string[]
  allTags: string[]
  onPickFeatured: () => void
}

export function PostSettings({ draft, update, allCategories, allTags, onPickFeatured }: Props) {
  return (
    <aside className="space-y-5">
      <Input
        label="Đường dẫn (slug)"
        value={draft.slug}
        onChange={(e) => update({ slug: e.target.value })}
        placeholder="tu-dong-tu-tieu-de"
      />

      <Input
        label="Ngày đăng"
        type="datetime-local"
        value={draft.date}
        onChange={(e) => update({ date: e.target.value })}
      />

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700">Trạng thái</span>
        <div className="flex gap-4 text-sm">
          {(['draft', 'published'] as PostStatus[]).map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="status"
                checked={draft.status === s}
                onChange={() => update({ status: s })}
              />
              {s === 'draft' ? 'Bản nháp' : 'Đã đăng'}
            </label>
          ))}
        </div>
      </div>

      <MultiSelect
        label="Danh mục"
        value={draft.categories}
        options={allCategories}
        onChange={(categories) => update({ categories })}
      />

      <MultiSelect
        label="Thẻ tag"
        value={draft.tags}
        options={allTags}
        onChange={(tags) => update({ tags })}
      />

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700">Ảnh đại diện</span>
        {draft.featuredImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.featuredImage} alt="" className="aspect-video w-full rounded-lg object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">
            Chưa chọn ảnh
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onPickFeatured} type="button">
            Chọn ảnh
          </Button>
          {draft.featuredImage && (
            <Button variant="ghost" onClick={() => update({ featuredImage: '' })} type="button">
              Bỏ chọn
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700">Hiển thị ảnh đại diện</span>
        <p className="text-xs text-neutral-400">
          Ảnh trong bài: chọn ảnh rồi bấm &quot;Ảnh toàn màn hình&quot; trên thanh công cụ.
        </p>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {(['post', 'full'] as ImageDisplay[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => update({ imageDisplay: d })}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                draft.imageDisplay === d ? 'bg-white shadow-sm' : 'text-neutral-500'
              }`}
            >
              {d === 'post' ? 'Vừa bài' : 'Toàn màn hình'}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        label="Mô tả"
        rows={3}
        value={draft.excerpt}
        onChange={(e) => update({ excerpt: e.target.value })}
        placeholder="Tự động lấy từ đoạn đầu nếu để trống"
      />
    </aside>
  )
}
