'use client'

// Drag-drop + click upload zone for the Files tab. Accepts ANY file type
// (it is the catch-all attachment store), multi-file, with a progress bar.
import { useRef, useState } from 'react'
import type { FileItem } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { uploadAttachments } from '@/lib/upload-client'
import { useAdminT } from './I18nProvider'

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
      const items = await uploadAttachments(files, setProgress)
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
