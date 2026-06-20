import type { SiteLang } from '@/types'
import type { Dict } from '@/locales/types'
import vi from '@/locales/vi'
import en from '@/locales/en'

export type { Dict }

const LOCALES: Record<SiteLang, Dict> = { vi, en }

export function t(lang: SiteLang): Dict {
  return LOCALES[lang] ?? vi
}

export function formatDate(iso: string, lang: SiteLang): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (lang === 'en') {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}
