// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import Link from '@/admin/router'
import { useAdminT } from '@/admin/components/I18nProvider'

export default function NotFound() {
  const t = useAdminT()
  return (
    <div className="py-24 text-center">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">404</p>
      <Link href="/admin" className="mt-3 inline-block text-sm underline">{t.navHome}</Link>
    </div>
  )
}
