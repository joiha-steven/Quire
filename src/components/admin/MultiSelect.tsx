'use client'

// Multi-select with inline create. Used for categories and tags.
import { useState } from 'react'

type Props = {
  label: string
  value: string[]
  options: string[]
  placeholder?: string
  onChange: (next: string[]) => void
}

export function MultiSelect({ label, value, options, placeholder, onChange }: Props) {
  const [draft, setDraft] = useState('')
  const suggestions = options.filter((o) => !value.includes(o))

  function add(item: string) {
    const v = item.trim()
    if (!v || value.includes(v)) return
    onChange([...value, v])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs text-white">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label="Xóa">
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(draft)
          }
        }}
        placeholder={placeholder ?? 'Nhập rồi nhấn Enter'}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 12).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => add(o)}
              className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
            >
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
