// Labeled text input + textarea primitives.
//
// `note` is not decoration: it is the reason the settings screens drifted. The primitive
// carried a label and nothing else, so every hint had to be hand-placed by its caller and
// they disagreed — above the control here, below it there, styled three ways. With a slot
// for it the order is decided ONCE, here, and no call site can hold a different opinion.
// The order is the one rule: what it is, what to know about it, then the control.
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { NOTE, SETTING_LABEL } from '@/admin/components/kit'

const FIELD =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800 dark:placeholder:text-neutral-500'

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; note?: ReactNode }

export function Input({ label, note, className = '', ...props }: InputProps) {
  return (
    <label className="block">
      {label && <span className={SETTING_LABEL}>{label}</span>}
      {note && <span className={`${NOTE} block`}>{note}</span>}
      <input className={`${FIELD} ${label || note ? 'mt-2' : ''} ${className}`} {...props} />
    </label>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; note?: ReactNode }

export function Textarea({ label, note, className = '', ...props }: TextareaProps) {
  return (
    <label className="block">
      {label && <span className={SETTING_LABEL}>{label}</span>}
      {note && <span className={`${NOTE} block`}>{note}</span>}
      <textarea className={`${FIELD} resize-y ${label || note ? 'mt-2' : ''} ${className}`} {...props} />
    </label>
  )
}
