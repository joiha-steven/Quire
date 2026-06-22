import type { Dict } from './types'

const zh = {
  emptyPosts: '还没有文章。',
  emptyCategory: '该分类下还没有文章。',
  emptyTag: '该标签下还没有文章。',
  categoryLabel: '分类',
  tagLabel: '标签',
  pageLabel: '页',
  menu: '菜单',
  palette: '配色',
  paletteNames: { mono: '单色', sepia: '棕褐', forest: '森林', ocean: '海洋', rose: '玫瑰', amber: '琥珀' },
  theme: '主题',
  themeLight: '浅色',
  themeDark: '深色',
  themeSystem: '跟随系统',
  themeTime: '按时间',
  readingSuffix: '分钟阅读',
  search: '搜索',
  searchPlaceholder: '搜索文章...',
  searchHint: '输入关键词搜索文章。',
  searchEmpty: '未找到匹配的文章。',
  tocTitle: '目录',
  relatedTitle: '相关文章',
  notFoundTitle: '页面未找到',
  notFoundText: '您查找的页面不存在或已被移动。',
  errorTitle: '出错了',
  errorText: '发生了意外错误，请重试。',
  tryAgain: '重试',
  backHome: '返回首页',
  backToTop: '回到顶部',
} satisfies Dict

export default zh
