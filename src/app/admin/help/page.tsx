// Admin Help & Guide: a concise, English index that links out to the repo docs.
// Server component — the localized title comes from adminT, the body is static.
import pkg from '../../../../package.json'
import { getSettings } from '@/lib/settings'
import { adminT } from '@/lib/admin-i18n'
import { HelpGuide } from '@/components/admin/HelpGuide'

export default async function AdminHelp() {
  const { language } = await getSettings()
  const t = adminT(language)
  return <HelpGuide title={t.navHelp} version={pkg.version} />
}
