// Public-site localization. Admin stays Vietnamese (owner console).
import type { SiteLang } from '@/types'

export type Dict = {
  emptyPosts: string
  emptyCategory: string
  emptyTag: string
  categoryLabel: string
  tagLabel: string
}

const DICT: Record<SiteLang, Dict> = {
  vi: {
    emptyPosts: 'Chưa có bài viết nào.',
    emptyCategory: 'Chưa có bài viết trong danh mục này.',
    emptyTag: 'Chưa có bài viết với thẻ này.',
    categoryLabel: 'Danh mục',
    tagLabel: 'Thẻ',
  },
  en: {
    emptyPosts: 'No posts yet.',
    emptyCategory: 'No posts in this category yet.',
    emptyTag: 'No posts with this tag yet.',
    categoryLabel: 'Category',
    tagLabel: 'Tag',
  },
}

// Strings for a language (falls back to Vietnamese).
export function t(lang: SiteLang): Dict {
  return DICT[lang] ?? DICT.vi
}

// Long-form date per language: "19 tháng 6, 2026" / "June 19, 2026".
export function formatDate(iso: string, lang: SiteLang): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (lang === 'en') {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}
