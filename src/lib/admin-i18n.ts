// Admin UI localization. Mirrors the public i18n but for the owner console.
import type { SiteLang } from '@/types'

export type AdminStrings = {
  // nav
  navAdmin: string
  navDashboard: string
  navMedia: string
  navSettings: string
  navViewBlog: string
  signOut: string
  // dashboard
  dashboardTitle: string
  tabPosts: string
  tabPages: string
  newPost: string
  newPage: string
  noPosts: string
  noPages: string
  confirmDeletePage: string
  colTitle: string
  colStatus: string
  colDate: string
  colCategories: string
  untitled: string
  statusPublished: string
  statusDraft: string
  edit: string
  delete: string
  confirmDeletePost: string
  deleted: string
  deleteFailed: string
  // editor
  titlePlaceholder: string
  saveDraft: string
  publish: string
  saving: string
  savedAtPrefix: string
  saveFailed: string
  slugTaken: string
  needTitle: string
  savedDraft: string
  published: string
  imageUploadFailed: string
  // toolbar
  promptLink: string
  promptVideo: string
  tbList: string
  tbLink: string
  tbImage: string
  tbImageFull: string
  tbImageFullHint: string
  tbVideo: string
  editorPlaceholder: string
  // settings panel (post)
  slug: string
  publishDate: string
  status: string
  categories: string
  tags: string
  featuredImage: string
  noImageSelected: string
  chooseImage: string
  removeSelection: string
  featuredDisplay: string
  featuredDisplayHint: string
  fitPost: string
  fullWidth: string
  excerpt: string
  excerptPlaceholder: string
  // multi-select
  multiPlaceholder: string
  removeAria: string
  // media
  mediaTitle: string
  copyUrl: string
  close: string
  loading: string
  noMedia: string
  confirmDeleteMedia: string
  copiedUrl: string
  loadMediaFailed: string
  // uploader
  dropzone: string
  uploaded: string
  uploadFailed: string
  // site settings form
  settingsTitle: string
  siteLanguage: string
  siteLanguageHint: string
  siteTitle: string
  siteDescription: string
  siteDescriptionPlaceholder: string
  showDescription: string
  showLogo: string
  noLogo: string
  chooseLogo: string
  removeLogo: string
  logoWidth: string
  logoWidthHint: string
  siteWidth: string
  siteWidthHint: string
  saveSettings: string
  savedSettings: string
  menuTitle: string
  menuLabelField: string
  menuHrefField: string
  menuAdd: string
  menuHint: string
}

const DICT: Record<SiteLang, AdminStrings> = {
  vi: {
    navAdmin: 'Quản trị',
    navDashboard: 'Trang / Bài viết',
    navMedia: 'Thư viện ảnh',
    navSettings: 'Cài đặt',
    navViewBlog: 'Xem blog',
    signOut: 'Đăng xuất',
    dashboardTitle: 'Trang / Bài viết',
    tabPosts: 'Bài viết',
    tabPages: 'Trang',
    newPost: 'Viết bài mới',
    newPage: 'Tạo trang mới',
    noPosts: 'Chưa có bài viết nào.',
    noPages: 'Chưa có trang nào.',
    confirmDeletePage: 'Xóa trang này? Hành động không thể hoàn tác.',
    colTitle: 'Tiêu đề',
    colStatus: 'Trạng thái',
    colDate: 'Ngày',
    colCategories: 'Danh mục',
    untitled: '(không tiêu đề)',
    statusPublished: 'Đã đăng',
    statusDraft: 'Bản nháp',
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    confirmDeletePost: 'Xóa bài viết này? Hành động không thể hoàn tác.',
    deleted: 'Đã xóa',
    deleteFailed: 'Xóa thất bại',
    titlePlaceholder: 'Tiêu đề bài viết',
    saveDraft: 'Lưu nháp',
    publish: 'Đăng bài',
    saving: 'Đang lưu...',
    savedAtPrefix: 'Đã lưu lúc',
    saveFailed: 'Lưu thất bại',
    slugTaken: 'Đường dẫn (slug) đã tồn tại, chọn đường dẫn khác',
    needTitle: 'Cần tiêu đề để đăng bài',
    savedDraft: 'Đã lưu nháp',
    published: 'Đã đăng bài',
    imageUploadFailed: 'Tải ảnh thất bại',
    promptLink: 'Nhập đường dẫn liên kết:',
    promptVideo: 'Dán link video (YouTube):',
    tbList: 'Danh sách',
    tbLink: 'Liên kết',
    tbImage: 'Ảnh',
    tbImageFull: 'Ảnh toàn màn hình',
    tbImageFullHint: 'Chọn ảnh trong bài rồi bấm để bật/tắt toàn màn hình',
    tbVideo: 'Video',
    editorPlaceholder: 'Bắt đầu viết...',
    slug: 'Đường dẫn (slug)',
    publishDate: 'Ngày đăng',
    status: 'Trạng thái',
    categories: 'Danh mục',
    tags: 'Thẻ tag',
    featuredImage: 'Ảnh đại diện',
    noImageSelected: 'Chưa chọn ảnh',
    chooseImage: 'Chọn ảnh',
    removeSelection: 'Bỏ chọn',
    featuredDisplay: 'Hiển thị ảnh đại diện',
    featuredDisplayHint: 'Ảnh trong bài: chọn ảnh rồi bấm "Ảnh toàn màn hình" trên thanh công cụ.',
    fitPost: 'Vừa bài',
    fullWidth: 'Toàn màn hình',
    excerpt: 'Mô tả',
    excerptPlaceholder: 'Để trống sẽ tự lấy 50 chữ đầu bài. Tối đa 200 ký tự.',
    multiPlaceholder: 'Nhập rồi nhấn Enter',
    removeAria: 'Xóa',
    mediaTitle: 'Thư viện ảnh',
    copyUrl: 'Sao chép URL',
    close: 'Đóng',
    loading: 'Đang tải...',
    noMedia: 'Chưa có ảnh nào.',
    confirmDeleteMedia: 'Xóa ảnh này? Hành động không thể hoàn tác.',
    copiedUrl: 'Đã sao chép URL',
    loadMediaFailed: 'Không tải được thư viện',
    dropzone: 'Kéo thả ảnh vào đây hoặc bấm để chọn',
    uploaded: 'Đã tải lên thành công',
    uploadFailed: 'Tải lên thất bại',
    settingsTitle: 'Cài đặt',
    siteLanguage: 'Ngôn ngữ site',
    siteLanguageHint: 'Đổi ngôn ngữ giao diện và định dạng ngày tháng.',
    siteTitle: 'Tiêu đề site',
    siteDescription: 'Mô tả site',
    siteDescriptionPlaceholder: 'Một dòng giới thiệu ngắn về blog',
    showDescription: 'Hiện mô tả site',
    showLogo: 'Hiện logo',
    noLogo: 'Chưa chọn logo.',
    chooseLogo: 'Chọn logo',
    removeLogo: 'Bỏ logo',
    logoWidth: 'Bề rộng logo trên header (px)',
    logoWidthHint: 'Áp dụng cho logo hiển thị trên header trang chủ (không ảnh hưởng preview ở trên).',
    siteWidth: 'Bề rộng site - desktop (px)',
    siteWidthHint: 'Độ rộng tối đa của cột nội dung trên màn lớn (mặc định 672).',
    saveSettings: 'Lưu cài đặt',
    savedSettings: 'Đã lưu cài đặt',
    menuTitle: 'Menu header',
    menuLabelField: 'Nhãn',
    menuHrefField: 'Đường dẫn',
    menuAdd: 'Thêm mục',
    menuHint: 'Đường dẫn: trang chủ /, bài viết hoặc trang /duong-dan, danh mục /category/ten, hoặc link ngoài https://...',
  },
  en: {
    navAdmin: 'Admin',
    navDashboard: 'Pages / Posts',
    navMedia: 'Media',
    navSettings: 'Settings',
    navViewBlog: 'View blog',
    signOut: 'Sign out',
    dashboardTitle: 'Pages / Posts',
    tabPosts: 'Posts',
    tabPages: 'Pages',
    newPost: 'New post',
    newPage: 'New page',
    noPosts: 'No posts yet.',
    noPages: 'No pages yet.',
    confirmDeletePage: 'Delete this page? This action cannot be undone.',
    colTitle: 'Title',
    colStatus: 'Status',
    colDate: 'Date',
    colCategories: 'Categories',
    untitled: '(untitled)',
    statusPublished: 'Published',
    statusDraft: 'Draft',
    edit: 'Edit',
    delete: 'Delete',
    confirmDeletePost: 'Delete this post? This action cannot be undone.',
    deleted: 'Deleted',
    deleteFailed: 'Delete failed',
    titlePlaceholder: 'Post title',
    saveDraft: 'Save draft',
    publish: 'Publish',
    saving: 'Saving...',
    savedAtPrefix: 'Saved at',
    saveFailed: 'Save failed',
    slugTaken: 'That slug is already taken, choose another',
    needTitle: 'A title is required to publish',
    savedDraft: 'Draft saved',
    published: 'Published',
    imageUploadFailed: 'Image upload failed',
    promptLink: 'Enter the link URL:',
    promptVideo: 'Paste a video link (YouTube):',
    tbList: 'List',
    tbLink: 'Link',
    tbImage: 'Image',
    tbImageFull: 'Full-width image',
    tbImageFullHint: 'Select an image in the post, then toggle full-width',
    tbVideo: 'Video',
    editorPlaceholder: 'Start writing...',
    slug: 'Slug (URL)',
    publishDate: 'Publish date',
    status: 'Status',
    categories: 'Categories',
    tags: 'Tags',
    featuredImage: 'Featured image',
    noImageSelected: 'No image selected',
    chooseImage: 'Choose image',
    removeSelection: 'Remove',
    featuredDisplay: 'Featured image display',
    featuredDisplayHint: 'In-body images: select an image, then use "Full-width image" on the toolbar.',
    fitPost: 'In column',
    fullWidth: 'Full width',
    excerpt: 'Excerpt',
    excerptPlaceholder: 'Leave blank to auto-use the first 50 words. Max 200 characters.',
    multiPlaceholder: 'Type, then press Enter',
    removeAria: 'Remove',
    mediaTitle: 'Media library',
    copyUrl: 'Copy URL',
    close: 'Close',
    loading: 'Loading...',
    noMedia: 'No media yet.',
    confirmDeleteMedia: 'Delete this image? This action cannot be undone.',
    copiedUrl: 'URL copied',
    loadMediaFailed: 'Failed to load media',
    dropzone: 'Drag images here or click to choose',
    uploaded: 'Uploaded successfully',
    uploadFailed: 'Upload failed',
    settingsTitle: 'Settings',
    siteLanguage: 'Site language',
    siteLanguageHint: 'Changes the interface language and date format.',
    siteTitle: 'Site title',
    siteDescription: 'Site description',
    siteDescriptionPlaceholder: 'A short tagline for the blog',
    showDescription: 'Show site description',
    showLogo: 'Show logo',
    noLogo: 'No logo selected.',
    chooseLogo: 'Choose logo',
    removeLogo: 'Remove logo',
    logoWidth: 'Header logo width (px)',
    logoWidthHint: 'Applies to the logo shown in the homepage header (not the preview above).',
    siteWidth: 'Site width - desktop (px)',
    siteWidthHint: 'Max width of the content column on large screens (default 672).',
    saveSettings: 'Save settings',
    savedSettings: 'Settings saved',
    menuTitle: 'Header menu',
    menuLabelField: 'Label',
    menuHrefField: 'Link',
    menuAdd: 'Add item',
    menuHint: 'Link: home /, post or page /slug, category /category/name, or external https://...',
  },
}

export function adminT(lang: SiteLang): AdminStrings {
  return DICT[lang] ?? DICT.vi
}
