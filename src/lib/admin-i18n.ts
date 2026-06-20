import type { SiteLang } from '@/types'
import type { AdminStrings } from '@/locales/types'
import vi from '@/locales/admin/vi'
import en from '@/locales/admin/en'

export type { AdminStrings }

const LOCALES: Record<SiteLang, AdminStrings> = { vi, en }

export function adminT(lang: SiteLang): AdminStrings {
  return LOCALES[lang] ?? vi
}
