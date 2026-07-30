// Reusable button with a few visual variants.
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

const STYLES: Record<Variant, string> = {
  primary:
    'bg-neutral-900 text-white shadow-sm hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200',
  secondary:
    'border border-neutral-200 bg-white text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
  // OUTLINED, where primary is solid. It was byte-identical to primary, which made "Delete
  // forever" the loudest control on its screen and the only thing between it and a deleted
  // post a native confirm(). Monochrome can still rank three weights: a solid fill for the
  // action you came to do, a strong outline for one that destroys something, and secondary's
  // faint border for everything else. It inverts on hover, so it does not read as disabled.
  danger:
    'border border-neutral-900 bg-transparent text-neutral-900 hover:bg-neutral-900 hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-neutral-900',
}

// `whitespace-nowrap` and `shrink-0` are load-bearing, not tidying. In a flex row beside
// anything long, a button with neither gets squeezed until its own LABEL wraps: the MCP card
// shipped "Tạo token" broken across two lines and twice as tall as the row it sat in. A
// button is a fixed object; it is the text beside it that gives way.
export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${STYLES[variant]} ${className}`}
      {...props}
    />
  )
}
