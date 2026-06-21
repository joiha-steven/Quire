import type { Dict } from './types'

const vi = {
  emptyPosts: 'Chưa có bài viết nào.',
  emptyCategory: 'Chưa có bài viết trong danh mục này.',
  emptyTag: 'Chưa có bài viết với thẻ này.',
  categoryLabel: 'Danh mục',
  tagLabel: 'Thẻ',
  pageLabel: 'Trang',
  menu: 'Menu',
  palette: 'Bảng màu',
  paletteNames: { mono: 'Đơn sắc', sepia: 'Nâu giấy', forest: 'Rừng xanh', ocean: 'Đại dương', rose: 'Hồng phấn', amber: 'Hổ phách' },
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
  backToTop: 'Lên đầu trang',
} satisfies Dict

export default vi
