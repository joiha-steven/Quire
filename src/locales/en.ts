import type { Dict } from './types'

const en = {
  emptyPosts: 'No posts yet.',
  emptyCategory: 'No posts in this category yet.',
  emptyTag: 'No posts with this tag yet.',
  categoryLabel: 'Category',
  tagLabel: 'Tag',
  pageLabel: 'Page',
  menu: 'Menu',
  palette: 'Palette',
  paletteNames: { mono: 'Mono', sepia: 'Sepia', forest: 'Forest', ocean: 'Ocean', rose: 'Rosé', amber: 'Amber' },
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
  backToTop: 'Back to top',
} satisfies Dict

export default en
