'use client'

// Page editor screen: left = TipTap editor, right = settings, bottom = action bar.
// Same flow as PostForm (auto-save + serialized manual save) but hits /api/pages
// and has no taxonomy or date.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PageWithContent, MediaItem, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { slugify, formatTime } from '@/lib/utils'
import { Editor, type EditorApi } from './Editor'
import { PageSettings, type PageDraft } from './PageSettings'
import { MediaLibrary } from './MediaLibrary'
import { useAdminT } from './I18nProvider'

type Props = { initial?: PageWithContent; contentWidth: number }
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

export function PageForm({ initial, contentWidth }: Props) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [draft, setDraft] = useState<PageDraft>(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickTarget | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(initial?.slug ?? null)

  const slugTouched = useRef(Boolean(initial?.slug))
  const currentSlug = useRef<string | null>(initial?.slug ?? null)
  const editorApi = useRef<EditorApi | null>(null)
  // Live editor content lives here (not in React state) so typing never
  // re-renders the form. Saves read editorApi.getMarkdown() for the latest text.
  const contentRef = useRef<string>(initial?.content ?? '')
  const draftRef = useRef(draft)
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const update = useCallback((partial: Partial<PageDraft>) => {
    setDirty(true)
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
      const content = editorApi.current?.getMarkdown() ?? contentRef.current
      if (!d.title.trim() && !content.trim()) return false
      setSaving(true)
      const payload: Partial<PageWithContent> = {
        title: d.title,
        slug: d.slug || slugify(d.title) || `page-${Date.now()}`,
        status: statusOverride ?? d.status,
        featuredImage: d.featuredImage || undefined,
        content,
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
        setSavedSlug(json.data.slug)
        setSavedAt(new Date().toISOString())
        setDirty(false)
        window.history.replaceState(null, '', `/admin/page-editor/${json.data.slug}`)
        // Drop the client Router Cache so the save shows on the next navigation.
        router.refresh()
        return true
      } catch {
        notify(t.saveFailed, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify, t, router],
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

  // Auto-save once a minute when there are unsaved changes.
  useEffect(() => {
    const id = setInterval(() => {
      if (dirtyRef.current) void enqueueSave()
    }, 60_000)
    return () => clearInterval(id)
  }, [enqueueSave])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

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
          onChange={(md) => { contentRef.current = md }}
          onDirty={() => setDirty(true)}
          onPickImage={() => setPicker('editor')}
          onUploadFile={uploadInline}
          apiRef={editorApi}
          contentWidth={contentWidth}
        />
        <PageSettings draft={draft} update={update} onPickFeatured={() => setPicker('featured')} />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 dark:border-neutral-800 dark:bg-neutral-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <span className="text-sm text-neutral-400 dark:text-neutral-500">
            {saving ? t.saving : savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''}
          </span>
          <div className="flex items-center gap-2">
            {draft.status === 'published' && savedSlug && (
              <a href={`/${savedSlug}`} target="_blank" rel="noopener" className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.viewPost}
              </a>
            )}
            <Button variant="secondary" onClick={() => handleSave('draft', t.savedDraft)} disabled={saving || !dirty}> {t.saveDraft} </Button>
            <Button onClick={() => handleSave('published', t.published)} disabled={saving || (!dirty && draft.status === 'published')}> {t.publish} </Button>
          </div>
        </div>
      </div>

      {picker && (
        <MediaLibrary mode="picker" onSelect={onPicked} onClose={() => setPicker(null)} />
      )}
    </div>
  )
}
