// Public-site localization. Admin stays Vietnamese (owner console).
import type { SiteLang } from '@/types'

export type Dict = {
  emptyPosts: string
  emptyCategory: string
  emptyTag: string
  categoryLabel: string
  tagLabel: string
  pageLabel: string
  menu: string
  theme: string
  themeLight: string
  themeDark: string
  themeSystem: string
  themeTime: string
  readingSuffix: string // after a number: "phút đọc" / "min read"
  search: string
  searchPlaceholder: string
  searchHint: string
  searchEmpty: string
  tocTitle: string
  relatedTitle: string
  notFoundTitle: string
  notFoundText: string
  backHome: string
}

const DICT: Record<SiteLang, Dict> = {
  vi: {
    emptyPosts: 'Chưa có bài viết nào.',
    emptyCategory: 'Chưa có bài viết trong danh mục này.',
    emptyTag: 'Chưa có bài viết với thẻ này.',
    categoryLabel: 'Danh mục',
    tagLabel: 'Thẻ',
    pageLabel: 'Trang',
    menu: 'Menu',
    theme: 'Giao diện',
    themeLight: 'Sáng',
    themeDark: 'Tối',
    themeSystem: 'Theo hệ thống',
    themeTime: 'Theo giờ',
    readingSuffix: 'phút đọc',
    search: 'Tìm kiếm',
    searchPlaceholder: 'Tìm bài viết...',
    searchHint: 'Nhập từ khoá để tìm bài viết.',
    searchEmpty: 'Không tìm thấy bài viết phù hợp.',
    tocTitle: 'Mục lục',
    relatedTitle: 'Bài viết liên quan',
    notFoundTitle: 'Không tìm thấy trang',
    notFoundText: 'Trang bạn tìm không tồn tại hoặc đã được dời đi.',
    backHome: 'Về trang chủ',
  },
  en: {
    emptyPosts: 'No posts yet.',
    emptyCategory: 'No posts in this category yet.',
    emptyTag: 'No posts with this tag yet.',
    categoryLabel: 'Category',
    tagLabel: 'Tag',
    pageLabel: 'Page',
    menu: 'Menu',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    themeTime: 'By time',
    readingSuffix: 'min read',
    search: 'Search',
    searchPlaceholder: 'Search posts...',
    searchHint: 'Type to search posts.',
    searchEmpty: 'No matching posts found.',
    tocTitle: 'Contents',
    relatedTitle: 'Related posts',
    notFoundTitle: 'Page not found',
    notFoundText: 'The page you are looking for does not exist or has moved.',
    backHome: 'Back home',
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
