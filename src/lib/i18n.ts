import type { SiteLang } from '@/types'
import type { Dict } from '@/locales/types'
import en from '@/locales/en'
import vi from '@/locales/vi'
import de from '@/locales/de'
import ja from '@/locales/ja'
import zh from '@/locales/zh'
import ko from '@/locales/ko'

export type { Dict }

const LOCALES: Record<SiteLang, Dict> = { en, vi, de, ja, zh, ko }

// English is the default fallback.
export function t(lang: SiteLang): Dict {
  return LOCALES[lang] ?? en
}

// BCP-47 tags for Intl date formatting (vi keeps a custom format below).
const DATE_LOCALE: Record<SiteLang, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  de: 'de-DE',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ko: 'ko-KR',
}

// Group a plain integer (e.g. a word count) for the reader's language: 1234 -> "1.234"
// (vi/de) / "1,234" (en). Uses the same BCP-47 tag as dates.
export function formatCount(n: number, lang: SiteLang): string {
  return n.toLocaleString(DATE_LOCALE[lang] ?? 'en-US')
}

export function formatDate(iso: string, lang: SiteLang): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // Vietnamese: explicit "19 tháng 6, 2026" (more reliable than Intl long form).
  if (lang === 'vi') return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
  return d.toLocaleDateString(DATE_LOCALE[lang] ?? 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Month name only, for the infinite-scroll timeline (the year is shown separately).
export function formatMonth(iso: string, lang: SiteLang): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (lang === 'vi') return `Tháng ${d.getMonth() + 1}`
  return d.toLocaleDateString(DATE_LOCALE[lang] ?? 'en-US', { month: 'long' })
}
