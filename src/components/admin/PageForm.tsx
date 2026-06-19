'use client'

// Page editor screen: left = TipTap editor, right = settings, bottom = action bar.
// Same flow as PostForm (auto-save + serialized manual save) but hits /api/pages
// and has no taxonomy or date.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PageWithContent, MediaItem, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { slugify, formatTime } from '@/lib/utils'
import { Editor, type EditorApi } from './Editor'
import { PageSettings, type PageDraft } from './PageSettings'
import { MediaLibrary } from './MediaLibrary'
import { useAdminT } from './I18nProvider'

type Props = { initial?: PageWithContent }
type PickTarget = 'editor' | 'featured'

function toDraft(initial?: PageWithContent): PageDraft {
  return {
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    status: initial?.status ?? 'draft',
    featuredImage: initial?.featuredImage ?? '',
    content: initial?.content ?? '',
  }
}

export function PageForm({ initial }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  const [draft, setDraft] = useState<PageDraft>(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickTarget | null>(null)

  const slugTouched = useRef(Boolean(initial?.slug))
  const currentSlug = useRef<string | null>(initial?.slug ?? null)
  const editorApi = useRef<EditorApi | null>(null)
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const update = useCallback((partial: Partial<PageDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial }
      if ('slug' in partial) slugTouched.current = true
      if ('title' in partial && !slugTouched.current) next.slug = slugify(partial.title ?? '')
      return next
    })
  }, [])

  // One save at a time: every save runs after the previous finishes (chained).
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())

  const doPersist = useCallback(
    async (statusOverride?: PageDraft['status']): Promise<boolean> => {
      const d = draftRef.current
      if (!d.title.trim() && !d.content.trim()) return false
      setSaving(true)
      const payload: Partial<PageWithContent> = {
        title: d.title,
        slug: d.slug || slugify(d.title) || `page-${Date.now()}`,
        status: statusOverride ?? d.status,
        featuredImage: d.featuredImage || undefined,
        content: d.content,
      }
      try {
        const editing = currentSlug.current
        const res = await fetch(editing ? `/api/pages/${editing}` : '/api/pages', {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json()) as ApiResponse<{ slug: string }>
        if (!json.success || !json.data) {
          notify(json.error === 'slug_taken' ? t.slugTaken : t.saveFailed, 'error')
          return false
        }
        currentSlug.current = json.data.slug
        setSavedAt(new Date().toISOString())
        window.history.replaceState(null, '', `/admin/page-editor/${json.data.slug}`)
        return true
      } catch {
        notify(t.saveFailed, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify, t],
  )

  const enqueueSave = useCallback(
    (statusOverride?: PageDraft['status']): Promise<boolean> => {
      const run = () => doPersist(statusOverride)
      const result = saveChain.current.then(run, run)
      saveChain.current = result.catch(() => {})
      return result
    },
    [doPersist],
  )

  // Debounced auto-save on any draft change (skips the initial mount).
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const id = setTimeout(() => void enqueueSave(), 2000)
    return () => clearTimeout(id)
  }, [draft, enqueueSave])

  async function handleSave(status: PageDraft['status'], successMsg: string) {
    if (status === 'published' && !draftRef.current.title.trim()) {
      notify(t.needTitle, 'error')
      return
    }
    update({ status })
    const okSaved = await enqueueSave(status)
    if (okSaved) notify(successMsg)
  }

  function onPicked(url: string) {
    if (picker === 'featured') update({ featuredImage: url })
    else editorApi.current?.insertImage(url)
    setPicker(null)
  }

  async function uploadInline(file: File): Promise<string | null> {
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: form })
      const json = (await res.json()) as ApiResponse<MediaItem[]>
      if (!json.success || !json.data?.[0]) throw new Error(json.error)
      return json.data[0].url
    } catch {
      notify(t.imageUploadFailed, 'error')
      return null
    }
  }

  return (
    <div className="pb-24">
      <input
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder={t.titlePlaceholder}
        className="mb-6 w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <Editor
          initialContent={draft.content}
          onChange={(content) => setDraft((prev) => ({ ...prev, content }))}
          onPickImage={() => setPicker('editor')}
          onUploadFile={uploadInline}
          apiRef={editorApi}
        />
        <PageSettings draft={draft} update={update} onPickFeatured={() => setPicker('featured')} />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 dark:border-neutral-800 dark:bg-neutral-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <span className="text-sm text-neutral-400 dark:text-neutral-500">
            {saving ? t.saving : savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => handleSave('draft', t.savedDraft)} disabled={saving}> {t.saveDraft} </Button>
            <Button onClick={() => handleSave('published', t.published)} disabled={saving}> {t.publish} </Button>
          </div>
        </div>
      </div>

      {picker && (
        <MediaLibrary mode="picker" onSelect={onPicked} onClose={() => setPicker(null)} />
      )}
    </div>
  )
}
