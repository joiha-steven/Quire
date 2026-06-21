'use client'

// Drag-drop + click upload zone for the Files tab. Accepts ANY file type
// (it is the catch-all attachment store), multi-file, with a progress bar.
import { useRef, useState } from 'react'
import type { FileItem, ApiResponse } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

// Upload via XHR so we can report progress.
function uploadFiles(files: File[], onProgress: (pct: number) => void): Promise<FileItem[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    files.forEach((f) => form.append('file', f))
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/files')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as ApiResponse<FileItem[]>
        if (json.success && json.data) resolve(json.data)
        else reject(new Error(json.error ?? 'Upload failed'))
      } catch (err) {
        reject(err as Error)
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(form)
  })
}

export function FileUploader({ onUploaded }: { onUploaded: (items: FileItem[]) => void }) {
  const t = useAdminT()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handle(files: File[]) {
    if (files.length === 0) return
    setProgress(0)
    try {
      const items = await uploadFiles(files, setProgress)
      onUploaded(items)
      notify(t.uploaded)
    } catch {
      notify(t.uploadFailed, 'error')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handle(Array.from(e.dataTransfer.files))
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center text-sm transition-colors ${
          dragging ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300 text-neutral-500'
        }`}
      >
        {t.filesDropzone}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handle(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>
      {progress !== null && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full bg-neutral-900 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
