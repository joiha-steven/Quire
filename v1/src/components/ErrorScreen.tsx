import type { ReactNode } from 'react'

// THE single source of the error-page look. Every error/edge screen routes through
// this so they can never drift: the public 404 (not-found), the admin 404, and the
// 5xx boundaries (ErrorView). Server-safe (no hooks) so server and client callers
// share it. `children` = the action links/buttons (styled with ERROR_LINK).
export const ERROR_LINK = 't-small font-medium text-link underline underline-offset-4'

export function ErrorScreen({ code, title, text, children }: {
  code: string
  title: string
  text: string
  children: ReactNode
}) {
  return (
    <div className="py-24 text-center">
      <p className="text-6xl font-bold tracking-tight text-heading">{code}</p>
      <h1 className="mt-4 fs-h3 font-semibold">{title}</h1>
      <p className="mt-2 text-meta">{text}</p>
      <div className="mt-8 flex items-center justify-center gap-5">{children}</div>
    </div>
  )
}
