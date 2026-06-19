'use client'

// Right-hand settings panel of the editor screen.
import type { PostStatus } from '@/types'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { MultiSelect } from './MultiSelect'
import { useAdminT } from './I18nProvider'

export type Draft = {
  title: string
  slug: string
  date: string // datetime-local value (local time, no zone)
  status: PostStatus
  categories: string[]
  tags: string[]
  featuredImage: string
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
  const t = useAdminT()
  return (
    <aside className="space-y-5">
      <Input
        label={t.slug}
        value={draft.slug}
        onChange={(e) => update({ slug: e.target.value })}
        placeholder="tu-dong-tu-tieu-de"
      />

      <Input
        label={t.publishDate}
        type="datetime-local"
        value={draft.date}
        onChange={(e) => update({ date: e.target.value })}
      />

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.status}</span>
        <div className="flex gap-4 text-sm">
          {(['draft', 'published'] as PostStatus[]).map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="status"
                checked={draft.status === s}
                onChange={() => update({ status: s })}
              />
              {s === 'draft' ? t.statusDraft : t.statusPublished}
            </label>
          ))}
        </div>
      </div>

      <MultiSelect
        label={t.categories}
        value={draft.categories}
        options={allCategories}
        onChange={(categories) => update({ categories })}
      />

      <MultiSelect
        label={t.tags}
        value={draft.tags}
        options={allTags}
        onChange={(tags) => update({ tags })}
      />

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.featuredImage}</span>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.featuredImageHint}</p>
        {draft.featuredImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.featuredImage} alt="" className="aspect-video w-full rounded-lg object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 dark:text-neutral-500">
            {t.noImageSelected}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onPickFeatured} type="button">
            {t.chooseImage}
          </Button>
          {draft.featuredImage && (
            <Button variant="ghost" onClick={() => update({ featuredImage: '' })} type="button">
              {t.removeSelection}
            </Button>
          )}
        </div>
      </div>

      <Textarea
        label={t.excerpt}
        rows={3}
        maxLength={200}
        value={draft.excerpt}
        onChange={(e) => update({ excerpt: e.target.value })}
        placeholder={t.excerptPlaceholder}
      />
    </aside>
  )
}
