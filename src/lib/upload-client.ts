// Browser-side upload helpers. Files go STRAIGHT from the browser to Vercel Blob
// (client direct upload), which bypasses the serverless 4.5MB request-body limit
// that used to silently drop large photos/files. The server then only records
// metadata (`/api/*/register`). Shared by the library uploaders AND the editor's
// inline paste/drop, so there is one upload path. Client-only (uses the browser
// `upload()` + fetch); import from client components.
import { upload } from '@vercel/blob/client'
import type { MediaItem, FileItem, ApiResponse } from '@/types'
import { slugify } from '@/lib/utils'

type Progress = (pct: number) => void

// Upload images, then register them; returns the new media rows (newest data).
export async function uploadImages(files: File[], onProgress?: Progress): Promise<MediaItem[]> {
  const items: { url: string; filename: string }[] = []
  let done = 0
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'image'
    const blob = await upload(`media/${base}.${ext}`, file, {
      access: 'public',
      handleUploadUrl: '/api/media/blob-token',
      contentType: file.type || undefined,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(((done + percentage / 100) / files.length) * 100)),
    })
    items.push({ url: blob.url, filename: file.name })
    done++
  }
  const res = await fetch('/api/media/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  const json = (await res.json()) as ApiResponse<MediaItem[]>
  if (!json.success || !json.data) throw new Error(json.error ?? 'register failed')
  return json.data
}

// Upload arbitrary attachments, then register them; returns the new file rows.
export async function uploadAttachments(files: File[], onProgress?: Progress): Promise<FileItem[]> {
  const items: { url: string; filename: string; size: number; contentType: string }[] = []
  let done = 0
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'file'
    const blob = await upload(`files/${base}.${ext}`, file, {
      access: 'public',
      handleUploadUrl: '/api/files/blob-token',
      contentType: file.type || undefined,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(((done + percentage / 100) / files.length) * 100)),
    })
    items.push({ url: blob.url, filename: file.name, size: file.size, contentType: file.type || 'application/octet-stream' })
    done++
  }
  const res = await fetch('/api/files/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  const json = (await res.json()) as ApiResponse<FileItem[]>
  if (!json.success || !json.data) throw new Error(json.error ?? 'register failed')
  return json.data
}
