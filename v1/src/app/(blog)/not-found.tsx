// 404 inside the blog shell (header + footer from the (blog) layout). Shares the
// ErrorScreen look with every other error page.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { ErrorScreen, ERROR_LINK } from '@/components/ErrorScreen'

export default async function NotFound() {
  const { language } = await getSettings()
  const s = t(language)
  return (
    <ErrorScreen code="404" title={s.notFoundTitle} text={s.notFoundText}>
      <Link href="/" className={ERROR_LINK}>{s.backHome}</Link>
    </ErrorScreen>
  )
}
