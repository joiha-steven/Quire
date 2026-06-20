'use client'

// Features tab: toggle reader-facing features on/off. Saves the partial
// { features } through /api/settings.
import { useState } from 'react'
import type { SiteSettings, FeatureSettings, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { ToggleRow } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

const ITEMS: { key: keyof FeatureSettings; label: string; desc: string }[] = [
  { key: 'search', label: 'Tìm kiếm', desc: 'Icon tìm trên header và trang /search.' },
  { key: 'toc', label: 'Mục lục', desc: 'Khung mục lục bên trái (desktop) cho bài có từ 3 đề mục.' },
  { key: 'related', label: 'Bài viết liên quan', desc: 'Gợi ý bài cùng thẻ/danh mục ở cuối bài.' },
  { key: 'readingTime', label: 'Thời gian đọc', desc: 'Ước tính "X phút đọc" ở dòng thông tin bài.' },
  { key: 'progressBar', label: 'Thanh tiến độ đọc', desc: 'Thanh mảnh trên đầu trang chạy theo khi cuộn.' },
]

export function FeaturesForm({ initial }: { initial: SiteSettings }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [features, setFeatures] = useState<FeatureSettings>(initial.features)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      })
      const json = (await res.json()) as ApiResponse<SiteSettings>
      if (!json.success) throw new Error(json.error)
      notify(t.savedSettings)
    } catch {
      notify(t.saveFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {ITEMS.map((f) => (
          <ToggleRow
            key={f.key}
            label={f.label}
            desc={f.desc}
            checked={features[f.key]}
            onChange={(v) => setFeatures((p) => ({ ...p, [f.key]: v }))}
          />
        ))}
      </div>

      <Button onClick={save} disabled={saving}>{saving ? t.saving : t.saveSettings}</Button>
    </div>
  )
}
