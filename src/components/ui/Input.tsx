// Labeled text input + textarea primitives.
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const FIELD =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800 dark:placeholder:text-neutral-500'

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string }

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>}
      <input className={`${FIELD} ${className}`} {...props} />
    </label>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }

export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>}
      <textarea className={`${FIELD} resize-y ${className}`} {...props} />
    </label>
  )
}
