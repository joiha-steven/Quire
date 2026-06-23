// Browser-side upload helpers. Two paths, picked by NEXT_PUBLIC_STORAGE_DRIVER:
//   - default (Vercel Blob): files go STRAIGHT from the browser to the store
//     (client direct upload), bypassing the serverless 4.5MB body limit; the server
//     then only records metadata (`/api/*/register`).
//   - 'local' (Docker / self-host): there is no client-direct-to-store, so the bytes
//     are POSTed to a server route (`/api/media/upload`, `/api/files/attach`) that
//     writes them to disk and registers them in one shot. A Node self-host has no
//     4.5MB cap, so large files are fine.
// Shared by the library uploaders AND the editor's inline paste/drop, so there is
// one upload path per resource. Client-only; import from client components.
import { upload } from '@vercel/blob/client'
import type { MediaItem, FileItem, ApiResponse } from '@/types'
import { slugify } from '@/lib/utils'

type Progress = (pct: number) => void

const LOCAL = process.env.NEXT_PUBLIC_STORAGE_DRIVER === 'local'

// POST files as multipart to a server route, reporting overall upload progress via
// XHR (fetch can't surface upload progress). Resolves the parsed API rows.
function postFiles<T>(url: string, files: File[], onProgress?: Progress): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    for (const f of files) fd.append('file', f)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as ApiResponse<T[]>
        if (!json.success || !json.data) reject(new Error(json.error ?? 'upload failed'))
        else resolve(json.data)
      } catch {
        reject(new Error(`upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('upload failed'))
    xhr.send(fd)
  })
}

// Upload images, then register them; returns the new media rows (newest data).
export async function uploadImages(files: File[], onProgress?: Progress): Promise<MediaItem[]> {
  if (LOCAL) return postFiles<MediaItem>('/api/media/upload', files, onProgress)

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
  if (LOCAL) return postFiles<FileItem>('/api/files/attach', files, onProgress)

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
