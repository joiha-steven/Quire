'use client'

// Features tab: toggle reader-facing features on/off. Saves the partial
// { features } through /api/settings.
import { useState } from 'react'
import type { SiteSettings, FeatureSettings, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

const ITEMS: { key: keyof FeatureSettings; label: string; desc: string }[] = [
  { key: 'search', label: 'Tìm kiếm', desc: 'Icon tìm trên header và trang /search.' },
  { key: 'toc', label: 'Mục lục', desc: 'Khung mục lục bên trái (desktop) cho bài có từ 3 đề mục.' },
  { key: 'related', label: 'Bài viết liên quan', desc: 'Gợi ý bài cùng thẻ/danh mục ở cuối bài.' },
  { key: 'readingTime', label: 'Thời gian đọc', desc: 'Ước tính "X phút đọc" ở dòng thông tin bài.' },
  { key: 'progressBar', label: 'Thanh tiến độ đọc', desc: 'Thanh mảnh trên đầu trang chạy theo khi cuộn.' },
]

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all dark:bg-neutral-900 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

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
          <div key={f.key} className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{f.label}</div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{f.desc}</p>
            </div>
            <Switch checked={features[f.key]} onChange={(v) => setFeatures((p) => ({ ...p, [f.key]: v }))} />
          </div>
        ))}
      </div>

      <Button onClick={save} disabled={saving}>{saving ? t.saving : t.saveSettings}</Button>
    </div>
  )
}
