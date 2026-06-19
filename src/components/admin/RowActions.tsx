'use client'

// Compact icon buttons for a content row: edit (pencil) + delete (trash).
import Link from 'next/link'
import { useAdminT } from './I18nProvider'

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4l10-10a2 2 0 0 0-3-3L5 17v3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICON = 'flex h-8 w-8 items-center justify-center rounded-lg'

export function RowActions({ editHref, onDelete }: { editHref: string; onDelete: () => void }) {
  const t = useAdminT()
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={editHref}
        aria-label={t.edit}
        title={t.edit}
        className={`${ICON} text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white`}
      >
        <PencilIcon />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        aria-label={t.delete}
        title={t.delete}
        className={`${ICON} text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white`}
      >
        <TrashIcon />
      </button>
    </div>
  )
}

// Monochrome status pill (no color): published vs draft.
export function StatusPill({ published, label }: { published: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        published
          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
      }`}
    >
      {label}
    </span>
  )
}
