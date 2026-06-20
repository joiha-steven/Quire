'use client'

// Controlled reader-feature toggles. Parent owns state + save.
import type { FeatureSettings } from '@/types'
import { ToggleRow } from '@/components/ui/Switch'

const ITEMS: { key: keyof FeatureSettings; label: string; desc: string }[] = [
  { key: 'search', label: 'Tìm kiếm', desc: 'Icon tìm trên header và trang /search.' },
  { key: 'toc', label: 'Mục lục', desc: 'Khung mục lục bên trái (desktop) cho bài có từ 3 đề mục.' },
  { key: 'related', label: 'Bài viết liên quan', desc: 'Gợi ý bài cùng thẻ/danh mục ở cuối bài.' },
  { key: 'readingTime', label: 'Thời gian đọc', desc: 'Ước tính "X phút đọc" ở dòng thông tin bài.' },
  { key: 'progressBar', label: 'Thanh tiến độ đọc', desc: 'Thanh mảnh trên đầu trang chạy theo khi cuộn.' },
]

type Props = { features: FeatureSettings; onChange: (f: FeatureSettings) => void }

export function FeatureFields({ features, onChange }: Props) {
  return (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {ITEMS.map((f) => (
        <ToggleRow
          key={f.key}
          label={f.label}
          desc={f.desc}
          checked={features[f.key]}
          onChange={(v) => onChange({ ...features, [f.key]: v })}
        />
      ))}
    </div>
  )
}
