'use client'

// Controlled SEO fields (canonical URL + crawler/feed toggles + OG fallback
// image). Parent owns state + save.
import { useState } from 'react'
import type { SiteSettings, SeoSettings } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ToggleRow } from '@/components/ui/Switch'
import { MediaLibrary } from './MediaLibrary'

type Feature = { key: keyof SeoSettings; label: string; desc: string; path: string }

const FEATURES: Feature[] = [
  { key: 'autoSchema', label: 'Tự động Schema (JSON-LD)', desc: 'Chèn dữ liệu có cấu trúc cho Google: WebSite ở trang chủ, BlogPosting ở mỗi bài viết.', path: '' },
  { key: 'sitemap', label: 'Sitemap', desc: 'Liệt kê mọi bài viết, trang, danh mục và thẻ để công cụ tìm kiếm thu thập đầy đủ.', path: '/sitemap.xml' },
  { key: 'rss', label: 'RSS Feed', desc: 'Nguồn cấp RSS 2.0 cho người đọc và trình tổng hợp tin theo dõi bài mới.', path: '/feed.xml' },
  { key: 'llms', label: 'llms.txt', desc: 'Mục lục nội dung dạng Markdown cho các trình thu thập AI (chuẩn llmstxt.org).', path: '/llms.txt' },
  { key: 'robots', label: 'robots.txt', desc: 'Cho phép thu thập, trỏ tới sitemap, và luôn chặn /admin với /api.', path: '/robots.txt' },
  { key: 'ogImage', label: 'Ảnh chia sẻ động (OG Image)', desc: 'Tự tạo ảnh chia sẻ cho mỗi bài: tiêu đề đặt trên ảnh nổi bật, hoặc trên ảnh dự phòng bên dưới.', path: '/og' },
]

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

export function SeoFields({ s, update }: Props) {
  const [picking, setPicking] = useState(false)
  const setFlag = (key: keyof SeoSettings, v: boolean) => update({ seo: { ...s.seo, [key]: v } })

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Input
          label="Địa chỉ trang (canonical)"
          value={s.siteUrl}
          onChange={(e) => update({ siteUrl: e.target.value })}
          placeholder="https://manhhung.me"
        />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Dùng cho sitemap, RSS, schema, llms.txt, ảnh OG và thẻ canonical. Để trống sẽ tự dùng tên miền Vercel.
        </p>
      </div>

      <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {FEATURES.map((f) => (
          <ToggleRow
            key={f.key}
            label={f.label}
            badge={f.path || undefined}
            desc={f.desc}
            checked={Boolean(s.seo[f.key])}
            onChange={(v) => setFlag(f.key, v)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Ảnh dự phòng (khi bài không có ảnh nổi bật)
        </div>
        <div className="flex items-center gap-4">
          {s.seo.ogFallbackImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.seo.ogFallbackImage} alt="OG" className="h-20 w-36 rounded-lg border border-neutral-200 object-cover dark:border-neutral-800" />
          ) : (
            <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-400 dark:border-neutral-700">
              Chưa chọn
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setPicking(true)}>Chọn ảnh</Button>
            {s.seo.ogFallbackImage && (
              <Button variant="ghost" type="button" onClick={() => update({ seo: { ...s.seo, ogFallbackImage: '' } })}>Xoá</Button>
            )}
          </div>
        </div>
      </div>

      {picking && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            update({ seo: { ...s.seo, ogFallbackImage: url } })
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
