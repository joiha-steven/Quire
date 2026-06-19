'use client'

// SEO tab: canonical site URL + crawler/feed/share features, each toggleable.
// Saves through the shared /api/settings endpoint (merges { siteUrl, seo }).
import { useState } from 'react'
import type { SiteSettings, SeoSettings, ApiResponse } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { MediaLibrary } from './MediaLibrary'
import { useAdminT } from './I18nProvider'

type Feature = { key: keyof SeoSettings; label: string; desc: string; path: string }

const FEATURES: Feature[] = [
  { key: 'autoSchema', label: 'Tự động Schema (JSON-LD)', desc: 'Chèn dữ liệu có cấu trúc cho Google: WebSite ở trang chủ, BlogPosting ở mỗi bài viết.', path: '' },
  { key: 'sitemap', label: 'Sitemap', desc: 'Liệt kê mọi bài viết, trang, danh mục và thẻ để công cụ tìm kiếm thu thập đầy đủ.', path: '/sitemap.xml' },
  { key: 'rss', label: 'RSS Feed', desc: 'Nguồn cấp RSS 2.0 cho người đọc và trình tổng hợp tin theo dõi bài mới.', path: '/feed.xml' },
  { key: 'llms', label: 'llms.txt', desc: 'Mục lục nội dung dạng Markdown cho các trình thu thập AI (chuẩn llmstxt.org).', path: '/llms.txt' },
  { key: 'robots', label: 'robots.txt', desc: 'Cho phép thu thập, trỏ tới sitemap, và luôn chặn /admin với /api.', path: '/robots.txt' },
  { key: 'ogImage', label: 'Ảnh chia sẻ động (OG Image)', desc: 'Tự tạo ảnh chia sẻ cho mỗi bài: tiêu đề đặt trên ảnh nổi bật, hoặc trên ảnh dự phòng bên dưới.', path: '/og' },
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

export function SeoForm({ initial }: { initial: SiteSettings }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [siteUrl, setSiteUrl] = useState(initial.siteUrl)
  const [seo, setSeo] = useState<SeoSettings>(initial.seo)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)

  const setFlag = (key: keyof SeoSettings, v: boolean) => setSeo((prev) => ({ ...prev, [key]: v }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, seo }),
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
      <div className="space-y-1.5">
        <Input
          label="Địa chỉ trang (canonical)"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://manhhung.me"
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Dùng cho sitemap, RSS, schema, llms.txt, ảnh OG và thẻ canonical. Để trống sẽ tự dùng tên miền Vercel.
        </p>
      </div>

      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {FEATURES.map((f) => (
          <div key={f.key} className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {f.label}
                {f.path && <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{f.path}</code>}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{f.desc}</p>
            </div>
            <Switch checked={Boolean(seo[f.key])} onChange={(v) => setFlag(f.key, v)} />
          </div>
        ))}
      </div>

      {/* Fallback share image used when a post has no featured image. */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Ảnh dự phòng (khi bài không có ảnh nổi bật)
        </div>
        <div className="flex items-center gap-4">
          {seo.ogFallbackImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seo.ogFallbackImage} alt="OG" className="h-20 w-36 rounded-lg border border-neutral-200 object-cover dark:border-neutral-800" />
          ) : (
            <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-400 dark:border-neutral-700">
              Chưa chọn
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setPicking(true)}>Chọn ảnh</Button>
            {seo.ogFallbackImage && (
              <Button variant="ghost" type="button" onClick={() => setSeo((p) => ({ ...p, ogFallbackImage: '' }))}>Xoá</Button>
            )}
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving}>{saving ? t.saving : t.saveSettings}</Button>

      {picking && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            setSeo((p) => ({ ...p, ogFallbackImage: url }))
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
