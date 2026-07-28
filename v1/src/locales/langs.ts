import type { SiteLang } from '@/types'

// Single source of truth for supported UI languages.
// To add a language: extend SiteLang, add a row here, create
// src/locales/<code>.ts + src/locales/admin/<code>.ts (TS enforces every key),
// and add a BCP-47 entry to DATE_LOCALE in i18n.ts. English is the default.
export const SITE_LANGS: { value: SiteLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '简体中文' },
  { value: 'ko', label: '한국어' },
]

export const LANG_CODES: SiteLang[] = SITE_LANGS.map((l) => l.value)

export function isSiteLang(v: unknown): v is SiteLang {
  return typeof v === 'string' && (LANG_CODES as string[]).includes(v)
}
