// Core domain types shared across the app.

export type PostStatus = 'draft' | 'published'

// Frontmatter + metadata for a single post.
// Stored as YAML frontmatter inside posts/{slug}.md and mirrored in _index.json.
export type Post = {
  title: string
  slug: string // custom URL, auto-generated from title if empty
  date: string // ISO 8601, past/present/future all valid
  status: PostStatus
  categories: string[]
  tags: string[]
  featuredImage?: string // Vercel Blob URL; used only for SEO/social meta, never shown
  excerpt?: string // auto-extracted from first paragraph if empty
  readingMinutes?: number // estimated read time, computed from the body at save (for lists)
}

// Full post = metadata + markdown body.
export type PostWithContent = Post & {
  content: string
}

// A snapshot of a post taken right before it was overwritten. Up to 3 are kept
// per slug at revisions/{slug}.json so the editor's "time machine" can restore
// recently-overwritten versions.
export type PostRevision = PostWithContent & {
  savedAt: string // ISO 8601, when the snapshot was taken
}

// A static page (About, Contact...). Like a post but with no taxonomy or date:
// not part of the feed, only reachable directly at /page/{slug}.
export type Page = {
  title: string
  slug: string
  status: PostStatus
  featuredImage?: string // Vercel Blob URL; used only for SEO/social meta, never shown
}

// Full page = metadata + markdown body.
export type PageWithContent = Page & {
  content: string
}

// One entry in media/_index.json.
export type MediaItem = {
  url: string // ORIGINAL (uncompressed) — stored store-relative, absolute on read
  filename: string
  size: number // bytes of the original
  uploadedAt: string // ISO 8601
  width?: number // original pixel dimensions (raster only)
  height?: number
  thumb?: string // library thumbnail — store-relative, absolute on read
  variants?: boolean // true if responsive -1024/-1600 (avif+webp) were generated
}

// A non-image file in the "Files" library (PDF, zip, docx, audio…). Stored under
// `files/` on Blob with its own manifest, separate from the image media library.
export type FileItem = {
  url: string // store-relative, absolute on read
  filename: string // display name (original upload name)
  size: number // bytes
  contentType: string // MIME type as uploaded
  uploadedAt: string // ISO 8601
}

// Site-wide settings, stored at settings/site.json.
export type SiteLang = 'vi' | 'en' | 'de' | 'ja' | 'zh' | 'ko'

// One configurable header navigation link (page, category, or custom URL).
export type MenuItem = {
  label: string
  href: string
}

// Customizable reading-surface colors (one set per light/dark mode). All hex.
export type ThemeColors = {
  bg: string // page background
  text: string // body text
  heading: string // h1/h2/h3 titles
  meta: string // secondary text (dates, captions)
  link: string // links
  rule: string // horizontal rule (---) and borders
}

export type ThemeSettings = {
  light: ThemeColors
  dark: ThemeColors
}

// The tunable typographic roles. Every piece of text on the public site maps to
// exactly one — no per-element hardcoded sizes. Each emits CSS vars
// (--fs-<role>, --lh-<role>, --ls-<role>).
export type TypeRole =
  | 'h1' // page/post titles + body H1 — biggest
  | 'h2' // list-card titles + body H2
  | 'h3'
  | 'h4'
  | 'h5'
  | 'body' // normal reading text (article body)
  | 'small' // secondary UI text: dates, meta, related, ToC, pagination, search
  | 'caption' // figure captions
  | 'code' // code blocks + inline code (monospace)

// One role's tuning: size (rem), line-height (unitless), letter-spacing (em).
export type TypeStyle = {
  size: number
  line: number
  spacing: number
}

// Full type system: a style per role + the global font-smoothing toggle. One
// source of truth, injected as CSS vars; owner-customizable with reset-to-default.
export type TypographySettings = {
  roles: Record<TypeRole, TypeStyle>
  smoothing: boolean // antialiased font-smoothing on body (off = browser default)
}

// One uploaded weight of the custom typeface.
export type FontFace = {
  weight: number // 400 | 500 | 600 | 700
  url: string // Blob URL; store-relative at rest, absolute on read
}

// Owner-uploaded custom typeface (stored on Blob under files/). All faces share one
// `family`, registered via @font-face per weight so bold/heading text is crisp (the
// site disables faux-bold synthesis). Empty family / no faces = bundled Inter.
export type FontSettings = {
  family: string // CSS font-family name; '' = no custom font
  faces: FontFace[] // one per uploaded weight (400/500/600/700)
}

// Search-engine / AI-crawler features, each independently toggleable.
export type SeoSettings = {
  autoSchema: boolean // inject JSON-LD structured data (WebSite + Article)
  sitemap: boolean // serve /sitemap.xml
  llms: boolean // serve /llms.txt (content index for AI crawlers)
  robots: boolean // serve a crawl-friendly robots.txt referencing the sitemap
  rss: boolean // serve /feed.xml (RSS 2.0)
  ogImage: boolean // generate a dynamic OG share image per post/page
  ogFallbackImage: string // image used when a post has no featured image; '' = none
}

// Feature toggles (Admin -> Settings -> Tính năng). Mostly reader-facing; the last
// one (activityLog) is an admin feature.
export type FeatureSettings = {
  search: boolean // header search icon + /search page
  toc: boolean // table of contents on long posts
  related: boolean // related posts at the end of an article
  readingTime: boolean // reading-time estimate in the post meta
  progressBar: boolean // reading-progress bar on posts
  activityLog: boolean // record admin mutations to the activity log (Admin -> Log)
}

export type SiteSettings = {
  language: SiteLang // public site language: drives lang attr, font, labels, dates
  title: string
  description: string
  siteUrl: string // canonical base URL (e.g. https://manhhung.me); '' -> derive from env
  logoUrl: string // '' when no logo
  logoWidth: number // px, horizontal width of the logo in the header
  showLogo: boolean
  showDescription: boolean
  faviconUrl: string // browser-tab icon; '' = the bundled default favicon
  appIconUrl: string // PWA / home-screen app icon (square); '' = favicon, else bundled default
  contentWidth: number // px, max width of the content column (desktop)
  postsPerPage: number // posts shown per page on home/category/tag lists
  relatedCount: number // related posts shown at the end of an article (0 = none)
  excerptLength: number // words auto-used as a post excerpt when none is set
  customCss: string // owner CSS injected into PUBLIC pages only ('' = none)
  menu: MenuItem[] // header navigation links
  themePreset: string // default palette for visitors (one of THEME_PRESETS ids)
  themes: Record<string, ThemeSettings> // per-palette reading colors (owner-customizable); keyed by preset id
  typography: TypographySettings // type scale + reading rhythm → CSS vars (--fs-*, --lh-body, --ls-body)
  customFont: FontSettings // owner-uploaded typeface (Blob files/); '' = bundled Inter
  seo: SeoSettings // SEO / crawler feature toggles
  features: FeatureSettings // reader-facing feature toggles
}

// Uniform API envelope returned by every route.
export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}
