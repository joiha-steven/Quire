import type { Dict } from './types'

const ko = {
  emptyPosts: '아직 게시물이 없습니다.',
  emptyCategory: '이 카테고리에는 아직 게시물이 없습니다.',
  emptyTag: '이 태그의 게시물이 아직 없습니다.',
  categoryLabel: '카테고리',
  tagLabel: '태그',
  pageLabel: '페이지',
  menu: '메뉴',
  palette: '색상',
  paletteNames: { mono: '모노', sepia: '세피아', forest: '포레스트', ocean: '오션', rose: '로즈', amber: '앰버' },
  theme: '테마',
  themeLight: '라이트',
  themeDark: '다크',
  themeSystem: '시스템',
  themeTime: '시간대별',
  readingSuffix: '분 읽기',
  search: '검색',
  searchPlaceholder: '게시물 검색...',
  searchHint: '키워드를 입력해 게시물을 검색하세요.',
  searchEmpty: '일치하는 게시물이 없습니다.',
  tocTitle: '목차',
  relatedTitle: '관련 게시물',
  notFoundTitle: '페이지를 찾을 수 없습니다',
  notFoundText: '찾으시는 페이지가 존재하지 않거나 이동되었습니다.',
  backHome: '홈으로',
  backToTop: '맨 위로',
} satisfies Dict

export default ko
