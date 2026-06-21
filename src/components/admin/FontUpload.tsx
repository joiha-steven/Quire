'use client'

// Custom typeface uploader. Sends the font file to POST /api/files/font (stored
// under files/ on Blob, separate from the media library), then reports back the
// { url, family } that drives @font-face site-wide. Parent owns state + save.
import { useRef, useState } from 'react'
import type { ApiResponse, FontSettings } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

type Props = {
  value: FontSettings
  onChange: (font: FontSettings) => void
}

export function FontUpload({ value, onChange }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function upload(file: File) {
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/files/font', { method: 'POST', body })
      const json = (await res.json()) as ApiResponse<FontSettings>
      if (!json.success || !json.data) throw new Error(json.error)
      onChange(json.data)
      notify(t.uploaded)
    } catch {
      notify(t.uploadFailed, 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.fontHint}</p>
      <div className="flex items-center gap-3">
        {value.family ? (
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{value.family}</span>
        ) : (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">{t.fontDefault}</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />
        <Button variant="secondary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? t.loading : t.fontChoose}
        </Button>
        {value.family && !busy && (
          <Button variant="ghost" type="button" onClick={() => onChange({ url: '', family: '' })}>
            {t.removeSelection}
          </Button>
        )}
      </div>
    </div>
  )
}
