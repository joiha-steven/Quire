'use client'

// Editor screen: left = TipTap editor, right = settings, bottom = action bar.
// Handles auto-save, manual save (draft/publish) and the media picker modal.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostWithContent, PostRevision, MediaItem, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { slugify, formatTime } from '@/lib/utils'
import { Editor, type EditorApi } from './Editor'
import { PostSettings, type Draft } from './PostSettings'
import { MediaLibrary } from './MediaLibrary'
import { TimeMachine } from './TimeMachine'
import { useAdminT } from './I18nProvider'

type Props = {
  initial?: PostWithContent
  allCategories: string[]
  allTags: string[]
  contentWidth: number
}

type PickTarget = 'editor' | 'featured'

// ISO -> value for <input type="datetime-local"> in local time.
function isoToLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDraft(initial?: PostWithContent): Draft {
  return {
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    date: isoToLocal(initial?.date ?? new Date().toISOString()),
    status: initial?.status ?? 'draft',
    categories: initial?.categories ?? [],
    tags: initial?.tags ?? [],
    featuredImage: initial?.featuredImage ?? '',
    excerpt: initial?.excerpt ?? '',
    content: initial?.content ?? '',
  }
}

export function PostForm({ initial, allCategories, allTags, contentWidth }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickTarget | null>(null)
  const [timeMachine, setTimeMachine] = useState(false)
  // Unsaved-changes flag: drives button states, autosave and the exit warning.
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

  const update = useCallback((partial: Partial<Draft>) => {
    setDirty(true)
    setDraft((prev) => {
      const next = { ...prev, ...partial }
      if ('slug' in partial) slugTouched.current = true
      if ('title' in partial && !slugTouched.current) next.slug = slugify(partial.title ?? '')
      return next
    })
  }, [])

  // One save at a time: every save runs after the previous finishes (chained),
  // so autosave and manual save never race or double-create a post.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())

  const doPersist = useCallback(
    async (statusOverride?: Draft['status']): Promise<boolean> => {
      const d = draftRef.current
      const content = editorApi.current?.getMarkdown() ?? contentRef.current
      if (!d.title.trim() && !content.trim()) return false
      setSaving(true)
      const payload: Partial<PostWithContent> = {
        title: d.title,
        // Always have a slug so the API never rejects a content-only draft.
        slug: d.slug || slugify(d.title) || `post-${Date.now()}`,
        date: d.date ? new Date(d.date).toISOString() : new Date().toISOString(),
        status: statusOverride ?? d.status,
        categories: d.categories,
        tags: d.tags,
        featuredImage: d.featuredImage || undefined,
        excerpt: d.excerpt,
        content,
      }
      try {
        const editing = currentSlug.current
        const res = await fetch(editing ? `/api/posts/${editing}` : '/api/posts', {
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
        // Keep the address bar in sync without remounting the editor.
        window.history.replaceState(null, '', `/admin/editor/${json.data.slug}`)
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

  // Queue a save behind any in-flight save and return its result.
  const enqueueSave = useCallback(
    (statusOverride?: Draft['status']): Promise<boolean> => {
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

  async function handleSave(status: Draft['status'], successMsg: string) {
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

  // Load an overwritten version back into the editor (slug + date stay current).
  function restoreRevision(rev: PostRevision) {
    update({
      title: rev.title,
      excerpt: rev.excerpt ?? '',
      featuredImage: rev.featuredImage ?? '',
      categories: rev.categories,
      tags: rev.tags,
      status: rev.status,
    })
    editorApi.current?.setMarkdown(rev.content)
    contentRef.current = rev.content
    setTimeMachine(false)
    notify('Đã nạp phiên bản này vào trình soạn thảo. Nhấn Lưu để áp dụng.')
  }

  // Copy a shareable draft-preview URL (tokened, viewable without signing in).
  async function copyPreviewLink() {
    const slug = currentSlug.current
    if (!slug) return
    try {
      const res = await fetch(`/api/preview-link?slug=${encodeURIComponent(slug)}`)
      const json = (await res.json()) as ApiResponse<{ token: string }>
      if (!json.success || !json.data) throw new Error()
      await navigator.clipboard.writeText(`${window.location.origin}/preview/${slug}?key=${json.data.token}`)
      notify('Đã sao chép link xem nháp')
    } catch {
      notify(t.saveFailed, 'error')
    }
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
        <PostSettings
          draft={draft}
          update={update}
          allCategories={allCategories}
          allTags={allTags}
          onPickFeatured={() => setPicker('featured')}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 dark:border-neutral-800 dark:bg-neutral-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <span className="text-sm text-neutral-400 dark:text-neutral-500">
            {saving ? t.saving : savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''}
          </span>
          <div className="flex items-center gap-2">
            {savedSlug && (
              <button type="button" onClick={() => setTimeMachine(true)} className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                Cỗ máy thời gian
              </button>
            )}
            {savedSlug && (
              <button type="button" onClick={copyPreviewLink} className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                Link nháp
              </button>
            )}
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

      {timeMachine && savedSlug && (
        <TimeMachine slug={savedSlug} onRestore={restoreRevision} onClose={() => setTimeMachine(false)} />
      )}
    </div>
  )
}
