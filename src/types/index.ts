// Core domain types shared across the app.

export type PostStatus = 'draft' | 'published'

export type ImageDisplay = 'post' | 'full'

// Frontmatter + metadata for a single post.
// Stored as YAML frontmatter inside posts/{slug}.md and mirrored in _index.json.
export type Post = {
  title: string
  slug: string // custom URL, auto-generated from title if empty
  date: string // ISO 8601, past/present/future all valid
  status: PostStatus
  categories: string[]
  tags: string[]
  featuredImage?: string // Vercel Blob URL
  imageDisplay?: ImageDisplay
  excerpt?: string // auto-extracted from first paragraph if empty
}

// Full post = metadata + markdown body.
export type PostWithContent = Post & {
  content: string
}

// One entry in media/_index.json.
export type MediaItem = {
  url: string
  filename: string
  size: number // bytes
  uploadedAt: string // ISO 8601
}

// Site-wide settings, stored at settings/site.json.
export type SiteLang = 'vi' | 'en'

// One configurable header navigation link (page, category, or custom URL).
export type MenuItem = {
  label: string
  href: string
}

export type SiteSettings = {
  language: SiteLang // public site language: drives lang attr, font, labels, dates
  title: string
  description: string
  logoUrl: string // '' when no logo
  logoWidth: number // px, horizontal width of the logo in the header
  showLogo: boolean
  showDescription: boolean
  contentWidth: number // px, max width of the content column (desktop)
  menu: MenuItem[] // header navigation links
}

// Uniform API envelope returned by every route.
export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}
