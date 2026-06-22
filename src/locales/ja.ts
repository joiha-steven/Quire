import type { Dict } from './types'

const ja = {
  emptyPosts: 'まだ投稿がありません。',
  emptyCategory: 'このカテゴリーにはまだ投稿がありません。',
  emptyTag: 'このタグの投稿はまだありません。',
  categoryLabel: 'カテゴリー',
  tagLabel: 'タグ',
  pageLabel: 'ページ',
  menu: 'メニュー',
  palette: 'パレット',
  paletteNames: { mono: 'モノ', sepia: 'セピア', forest: 'フォレスト', ocean: 'オーシャン', rose: 'ローズ', amber: 'アンバー' },
  theme: 'テーマ',
  themeLight: 'ライト',
  themeDark: 'ダーク',
  themeSystem: 'システム',
  themeTime: '時間帯で切替',
  readingSuffix: '分で読めます',
  search: '検索',
  searchPlaceholder: '投稿を検索...',
  searchHint: 'キーワードを入力して投稿を検索します。',
  searchEmpty: '一致する投稿が見つかりません。',
  tocTitle: '目次',
  relatedTitle: '関連記事',
  notFoundTitle: 'ページが見つかりません',
  notFoundText: 'お探しのページは存在しないか、移動されました。',
  errorTitle: '問題が発生しました',
  errorText: '予期しないエラーが発生しました。もう一度お試しください。',
  tryAgain: '再試行',
  backHome: 'ホームに戻る',
  backToTop: 'トップへ戻る',
} satisfies Dict

export default ja
