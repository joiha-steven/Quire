'use client'

// Editor screen: left = TipTap editor, right = settings, bottom = action bar.
// Handles auto-save, manual save (draft/publish) and the media picker modal.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PostWithContent, PostRevision, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { slugify, formatTime } from '@/lib/utils'
import { uploadImages } from '@/lib/upload-client'
import { Editor, type EditorApi } from './Editor'
import { PostSettings, type Draft } from './PostSettings'
import { MediaLibrary } from './MediaLibrary'
import { TimeMachine } from './TimeMachine'
import { useLocalDraft } from './useLocalDraft'
import { useAdminT } from './I18nProvider'

type Props = {
  initial?: PostWithContent
  allCategories: string[]
  allTags: string[]
  contentWidth: number
}

type PickTarget = 'editor' | 'gallery' | 'featured'

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
  const router = useRouter()
  const { notify } = useToast()
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickTarget | null>(null)
  const [timeMachine, setTimeMachine] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(true)
  // Unsaved-changes flag: drives button states, autosave and the exit warning.
  const [dirty, setDirty] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(initial?.slug ?? null)
  // Local (offline) autosave — keyed per post so drafts don't clobber each other.
  const {
    recovered: localRecovered,
    save: saveLocal,
    clear: clearLocal,
    dismiss: dismissLocal,
  } = useLocalDraft<Draft>(`quire:draft:post:${initial?.slug ?? 'new'}`)

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
        clearLocal() // the server now has it — drop the local recovery copy
        // Keep the address bar in sync without remounting the editor.
        window.history.replaceState(null, '', `/admin/editor/${json.data.slug}`)
        // Drop the client Router Cache so admin lists + the public site show this
        // save on the next navigation (no stale RSC). Server purge already ran.
        router.refresh()
        return true
      } catch {
        notify(t.saveFailed, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify, t, router, clearLocal],
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

  // Local (offline) autosave: stash unsaved edits in localStorage every few
  // seconds. Crucially this NEVER writes to the server, so editing a published
  // post can't push half-finished text live — only Save/Publish does that.
  useEffect(() => {
    const id = setInterval(() => {
      if (!dirtyRef.current) return
      const content = editorApi.current?.getMarkdown() ?? contentRef.current
      saveLocal({ ...draftRef.current, content })
    }, 8_000)
    return () => clearInterval(id)
  }, [saveLocal])

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

  // Single pick (image / featured). Gallery uses multi-select -> onPickedMany.
  function onPicked(url: string) {
    if (picker === 'featured') update({ featuredImage: url })
    else editorApi.current?.insertImage(url)
    setPicker(null)
  }

  // Gallery: insert every chosen image as a #grid item (they group into a grid).
  function onPickedMany(urls: string[]) {
    editorApi.current?.insertGalleryMany(urls)
    setPicker(null)
  }

  // Pull a recovered local snapshot back into the form (slug/date stay current).
  function restoreLocal() {
    if (!localRecovered) return
    const d = localRecovered.data
    setDraft(d)
    draftRef.current = d
    editorApi.current?.setMarkdown(d.content)
    contentRef.current = d.content
    setDirty(true)
    clearLocal()
    notify(t.revisionLoaded)
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
    notify(t.revisionLoaded)
  }

  // Open the tokened draft preview in a new tab. Saves any pending edits FIRST so
  // the preview reflects the latest content (autosave is local-only, never server),
  // then points the tab at /preview/{slug}?key=. The tab is opened synchronously
  // (before the await) or the popup blocker kills a post-await window.open.
  async function openPreview() {
    const tab = window.open('', '_blank')
    if (dirtyRef.current) {
      const saved = await enqueueSave()
      if (!saved) {
        tab?.close()
        return // enqueueSave already surfaced the error
      }
    }
    const slug = currentSlug.current
    if (!slug) {
      tab?.close()
      return
    }
    try {
      const res = await fetch(`/api/preview-link?slug=${encodeURIComponent(slug)}`)
      const json = (await res.json()) as ApiResponse<{ token: string }>
      if (!json.success || !json.data) throw new Error()
      const url = `${window.location.origin}/preview/${slug}?key=${json.data.token}`
      if (tab) tab.location.href = url
      else window.open(url, '_blank') // popup was blocked — best-effort second try
    } catch {
      tab?.close()
      notify(t.saveFailed, 'error')
    }
  }

  async function uploadInline(file: File): Promise<string | null> {
    try {
      const [item] = await uploadImages([file])
      return item?.url ?? null
    } catch {
      notify(t.imageUploadFailed, 'error')
      return null
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 -mt-6 mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-12 lg:-mt-8 lg:px-12 dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin/content" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">← {t.navDashboard}</Link>
          <span className="hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800" />
          <span className="hidden text-sm text-neutral-400 sm:block">
            {saving ? t.saving : savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : dirty ? 'Chưa lưu' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSettingsOpen((v) => !v)} className="border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
            {settingsOpen ? 'Ẩn thuộc tính' : 'Thuộc tính'}
          </button>
          {savedSlug && <button type="button" onClick={openPreview} className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">{t.previewDraft}</button>}
          <Button variant="secondary" onClick={() => handleSave('draft', t.savedDraft)} disabled={saving || !dirty}>{t.saveDraft}</Button>
          <Button onClick={() => handleSave('published', t.published)} disabled={saving || (!dirty && draft.status === 'published')}>{t.publish}</Button>
        </div>
      </div>

      {localRecovered && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <span className="text-amber-800 dark:text-amber-200">
            {t.localDraftFound} · {formatTime(localRecovered.at)}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={restoreLocal} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">
              {t.localDraftRestore}
            </button>
            <button type="button" onClick={dismissLocal} className="rounded-md px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/20">
              {t.localDraftDiscard}
            </button>
          </div>
        </div>
      )}

      <div className={`grid items-start gap-8 ${settingsOpen ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <div className="min-w-0">
          <div className="mx-auto mb-6 w-full" style={{ maxWidth: contentWidth }}>
            <input
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder={t.titlePlaceholder}
              className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
            />
          </div>
          <Editor initialContent={draft.content} onChange={(md) => { contentRef.current = md }} onDirty={() => setDirty(true)} onPickImage={() => setPicker('editor')} onPickGallery={() => setPicker('gallery')} onUploadFile={uploadInline} apiRef={editorApi} contentWidth={contentWidth} />
        </div>
        {settingsOpen && (
          <aside className="border-l border-neutral-200 pl-6 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto dark:border-neutral-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Thuộc tính</h2>
              <div className="flex gap-3 text-xs">
                {savedSlug && <button type="button" onClick={() => setTimeMachine(true)} className="text-neutral-500 hover:text-neutral-900">Lịch sử</button>}
                {draft.status === 'published' && savedSlug && <a href={`/${savedSlug}`} target="_blank" rel="noopener" className="text-neutral-500 hover:text-neutral-900">{t.viewPost}</a>}
              </div>
            </div>
            <PostSettings draft={draft} update={update} allCategories={allCategories} allTags={allTags} onPickFeatured={() => setPicker('featured')} />
          </aside>
        )}
      </div>

      {picker && (
        <MediaLibrary
          mode="picker"
          multi={picker === 'gallery'}
          onSelect={onPicked}
          onSelectMany={onPickedMany}
          onClose={() => setPicker(null)}
        />
      )}

      {timeMachine && savedSlug && (
        <TimeMachine slug={savedSlug} onRestore={restoreRevision} onClose={() => setTimeMachine(false)} />
      )}
    </div>
  )
}
