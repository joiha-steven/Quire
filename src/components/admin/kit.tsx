// Admin UI kit — ONE source of truth for the shared chrome so no page hand-rolls
// its own card/header/tabs/table and they can never drift again (radius, padding,
// shadow, header size were all inconsistent before). Admin is monochrome by design
// (neutral scale, no public theme tokens). No `'use client'`: these are presentational
// — pure primitives render in server OR client trees; Tabs only takes props.
import Link from 'next/link'
import type { ReactNode } from 'react'

// Canonical card surface. ONE radius + border + shadow for every admin panel.
export const CARD =
  'rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.035)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none'

// Card: a titled panel. `title` optional (stat-style panels pass none). `actions`
// renders on the right of the header row.
export function Card({
  title,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`${CARD} p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

// Page header: the one title block every admin screen uses (was a copy-pasted
// `<h1>` on each page). Optional description + right-aligned actions slot.
export function PageHeader({
  title,
  description,
  actions,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`mb-7 flex flex-wrap items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-neutral-950 dark:text-white">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

// Tabs — ONE component for both admin tab styles:
//   'underline' (Settings): bottom-border chips on a rule.
//   'segment'   (Content):  segmented control on a tinted track.
export type TabItem<K extends string = string> = { key: K; label: ReactNode }

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  variant = 'underline',
  className = '',
}: {
  tabs: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  variant?: 'underline' | 'segment'
  className?: string
}) {
  if (variant === 'segment') {
    return (
      <div className={`inline-flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800 ${className}`}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => onChange(tb.key)}
            aria-pressed={value === tb.key}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              value === tb.key
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className={`flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-neutral-200/70 p-1 dark:bg-neutral-800 ${className}`}>
      {tabs.map((tb) => (
        <button
          key={tb.key}
          type="button"
          onClick={() => onChange(tb.key)}
          aria-pressed={value === tb.key}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            value === tb.key
              ? 'bg-white text-neutral-950 shadow-sm dark:bg-neutral-700 dark:text-white'
              : 'text-neutral-500 hover:bg-white/60 hover:text-neutral-900 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200'
          }`}
        >
          {tb.label}
        </button>
      ))}
    </div>
  )
}

// Stat tile for the Overview dashboard. Optional `icon`, `sub` line, and `href`
// (wraps the whole tile in a link with a hover lift).
export function StatCard({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  href?: string
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[1.65rem] font-semibold tracking-tight tabular-nums">{value}</div>
        {icon && <span className="text-neutral-300 dark:text-neutral-600">{icon}</span>}
      </div>
      <div className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{sub}</div>}
    </>
  )
  if (href) {
    return (
      <Link href={href} className={`${CARD} block p-5 transition duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:hover:border-neutral-700 dark:hover:bg-neutral-800/40`}>
        {inner}
      </Link>
    )
  }
  return <div className={`${CARD} p-5`}>{inner}</div>
}

// Empty / zero state — centered muted message, optional icon + action.
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      {icon && <div className="mb-3 text-neutral-300 dark:text-neutral-600">{icon}</div>}
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-400 dark:text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Table chrome — shared so the 4 admin tables stop re-declaring wrapper + head
// classes. `TableFrame` is the rounded, bordered surface; `TH`/`TD` standardize cells.
export const TABLE_FRAME = `overflow-hidden ${CARD}`
export const THEAD =
  'whitespace-nowrap border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
export const TROW = 'border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40'

export function TableFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${TABLE_FRAME} ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}
