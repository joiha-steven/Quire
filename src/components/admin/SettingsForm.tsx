'use client'

// Site settings form: title, description, logo (toggle + picker), show-description.
import { useState } from 'react'
import type { SiteSettings, SiteLang, ApiResponse } from '@/types'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { MediaLibrary } from './MediaLibrary'

// A simple labeled on/off switch.
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-neutral-900' : 'bg-neutral-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const { notify } = useToast()
  const [s, setS] = useState<SiteSettings>(initial)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)

  const update = (partial: Partial<SiteSettings>) => setS((prev) => ({ ...prev, ...partial }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      const json = (await res.json()) as ApiResponse<SiteSettings>
      if (!json.success) throw new Error(json.error)
      notify('Đã lưu cài đặt')
    } catch {
      notify('Lưu thất bại', 'error')
    } finally {
      setSaving(false)
    }
  }

  const LANGS: { value: SiteLang; label: string }[] = [
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'en', label: 'English' },
  ]

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700">Ngôn ngữ site</span>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => update({ language: l.value })}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                s.language === l.value ? 'bg-white shadow-sm' : 'text-neutral-500'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400">
          Đổi ngôn ngữ, định dạng ngày và font hiển thị (Việt: Be Vietnam Pro, Anh: Inter).
        </p>
      </div>

      <Input
        label="Tiêu đề site"
        value={s.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="vibeblog"
      />

      <Textarea
        label="Mô tả site"
        rows={2}
        value={s.description}
        onChange={(e) => update({ description: e.target.value })}
        placeholder="Một dòng giới thiệu ngắn về blog"
      />

      <Toggle
        label="Hiện mô tả site"
        checked={s.showDescription}
        onChange={(v) => update({ showDescription: v })}
      />

      <hr className="border-neutral-200" />

      <Toggle label="Hiện logo" checked={s.showLogo} onChange={(v) => update({ showLogo: v })} />

      {s.showLogo && (
        <div className="space-y-3">
          {/* Fixed-size preview just to confirm which image is selected. */}
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt="Logo" className="h-12 w-auto rounded bg-neutral-100 p-1" />
          ) : (
            <p className="text-xs text-neutral-400">Chưa chọn logo.</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setPicking(true)}>
              Chọn logo
            </Button>
            {s.logoUrl && (
              <Button variant="ghost" type="button" onClick={() => update({ logoUrl: '' })}>
                Bỏ logo
              </Button>
            )}
          </div>
          <Input
            label="Bề rộng logo trên header (px)"
            type="number"
            min={24}
            max={600}
            value={s.logoWidth}
            onChange={(e) => update({ logoWidth: Number(e.target.value) })}
          />
          <p className="-mt-3 text-xs text-neutral-400">
            Áp dụng cho logo hiển thị trên header trang chủ (không ảnh hưởng preview ở trên).
          </p>
        </div>
      )}

      <hr className="border-neutral-200" />

      <Input
        label="Bề rộng site - desktop (px)"
        type="number"
        min={360}
        max={1600}
        value={s.contentWidth}
        onChange={(e) => update({ contentWidth: Number(e.target.value) })}
      />
      <p className="-mt-3 text-xs text-neutral-400">
        Độ rộng tối đa của cột nội dung trên màn lớn (mặc định 672).
      </p>

      <div className="pt-2">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </Button>
      </div>

      {picking && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            update({ logoUrl: url })
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
