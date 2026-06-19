'use client'

// Editor screen: left = TipTap editor, right = settings, bottom = action bar.
// Handles auto-save, manual save (draft/publish) and the media picker modal.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostWithContent, MediaItem, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { slugify, formatTime } from '@/lib/utils'
import { Editor, type EditorApi } from './Editor'
import { PostSettings, type Draft } from './PostSettings'
import { MediaLibrary } from './MediaLibrary'

type Props = {
  initial?: PostWithContent
  allCategories: string[]
  allTags: string[]
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
    imageDisplay: initial?.imageDisplay ?? 'post',
    excerpt: initial?.excerpt ?? '',
    content: initial?.content ?? '',
  }
}

export function PostForm({ initial, allCategories, allTags }: Props) {
  const router = useRouter()
  const { notify } = useToast()
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
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

  const update = useCallback((partial: Partial<Draft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial }
      if ('slug' in partial) slugTouched.current = true
      if ('title' in partial && !slugTouched.current) next.slug = slugify(partial.title ?? '')
      return next
    })
  }, [])

  // Persist current draft. statusOverride forces draft/published.
  const persist = useCallback(
    async (statusOverride?: Draft['status']): Promise<boolean> => {
      const d = draftRef.current
      if (!d.title.trim() && !d.content.trim()) return false
      setSaving(true)
      const payload: Partial<PostWithContent> = {
        title: d.title,
        slug: d.slug || slugify(d.title),
        date: d.date ? new Date(d.date).toISOString() : new Date().toISOString(),
        status: statusOverride ?? d.status,
        categories: d.categories,
        tags: d.tags,
        featuredImage: d.featuredImage || undefined,
        imageDisplay: d.imageDisplay,
        excerpt: d.excerpt,
        content: d.content,
      }
      try {
        const editing = currentSlug.current
        const res = await fetch(editing ? `/api/posts/${editing}` : '/api/posts', {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json()) as ApiResponse<{ slug: string }>
        if (!json.success || !json.data) throw new Error(json.error)
        const wasNew = !editing
        currentSlug.current = json.data.slug
        setSavedAt(new Date().toISOString())
        if (wasNew) router.replace(`/admin/editor/${json.data.slug}`)
        return true
      } catch {
        notify('Lưu thất bại', 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify, router],
  )

  // Debounced auto-save on any draft change (skips the initial mount).
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const id = setTimeout(() => void persist(), 2000)
    return () => clearTimeout(id)
  }, [draft, persist])

  async function handleSave(status: Draft['status'], successMsg: string) {
    update({ status })
    const okSaved = await persist(status)
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
      notify('Tải ảnh thất bại', 'error')
      return null
    }
  }

  return (
    <div className="pb-24">
      <input
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Tiêu đề bài viết"
        className="mb-6 w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-neutral-300"
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <Editor
          initialContent={draft.content}
          onChange={(content) => setDraft((prev) => ({ ...prev, content }))}
          onPickImage={() => setPicker('editor')}
          onUploadFile={uploadInline}
          apiRef={editorApi}
        />
        <PostSettings
          draft={draft}
          update={update}
          allCategories={allCategories}
          allTags={allTags}
          onPickFeatured={() => setPicker('featured')}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <span className="text-sm text-neutral-400">
            {saving ? 'Đang lưu...' : savedAt ? `Đã lưu lúc ${formatTime(savedAt)}` : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => handleSave('draft', 'Đã lưu nháp')} disabled={saving}>
              Lưu nháp
            </Button>
            <Button onClick={() => handleSave('published', 'Đã đăng bài')} disabled={saving}>
              Đăng bài
            </Button>
          </div>
        </div>
      </div>

      {picker && (
        <MediaLibrary mode="picker" onSelect={onPicked} onClose={() => setPicker(null)} />
      )}
    </div>
  )
}
