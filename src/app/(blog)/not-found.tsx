// 404 inside the blog shell (header + footer come from the (blog) layout).
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'

export default async function NotFound() {
  const { language } = await getSettings()
  const s = t(language)
  return (
    <div className="py-24 text-center">
      <p className="text-6xl font-bold tracking-tight text-heading">404</p>
      <h1 className="mt-4 fs-h3 font-semibold">{s.notFoundTitle}</h1>
      <p className="mt-2 text-meta">{s.notFoundText}</p>
      <Link href="/" className="mt-8 inline-block t-small font-medium text-link underline underline-offset-4">
        {s.backHome}
      </Link>
    </div>
  )
}
