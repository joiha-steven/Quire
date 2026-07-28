// 404 for unmatched admin URLs — renders inside the admin shell, same ErrorScreen
// look as the public 404 so every error page is consistent.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { ErrorScreen, ERROR_LINK } from '@/components/ErrorScreen'

export default async function AdminNotFound() {
  const { language } = await getSettings()
  const s = t(language)
  return (
    <ErrorScreen code="404" title={s.notFoundTitle} text={s.notFoundText}>
      <Link href="/admin" className={ERROR_LINK}>{s.backHome}</Link>
    </ErrorScreen>
  )
}
