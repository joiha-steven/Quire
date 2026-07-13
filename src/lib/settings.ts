// Settings: a single row (id=1) in Postgres `settings`. Reads fall back to
// defaults on any failure so the header/<title> never crash. Image refs stored
// store-relative, binaries on Blob. Validation/migration lives in settings-sanitize.ts.

import { cache } from 'react'
import type { BackupSettings, CommentSettings, FeatureSettings, FontSettings, SeoSettings, SiteSettings, TypographySettings } from '@/types'
import { collapseBlob, expandBlob, deleteByPathname } from '@/lib/blob'
import { renderLogo } from '@/lib/files'
import { db } from '@/lib/db'
import { isSiteLang } from '@/locales/langs'
import { DEFAULT_PRESET_ID, isPresetId, isFontPresetId, defaultThemes, ALL_PALETTE_IDS, DEFAULT_TYPOGRAPHY, DEFAULT_FONT, DEFAULT_FONT_PRESET, TYPE_ROLES } from '@/lib/themes'
import {
  sanitizeMenu, migrateThemes, sanitizeThemes, sanitizeEnabledPalettes, sanitizeSeo, sanitizeFeatures, sanitizeMcp, sanitizeMotion,
  sanitizeBackups, sanitizeComments, sanitizeCss, sanitizeUrl, sanitizeTypography, sanitizeFont, fontFormat, clampNumber,
} from '@/lib/settings-sanitize'

// Re-export so existing importers keep working.
export { DEFAULT_THEME, themesToCss, getDefaultTheme, DEFAULT_TYPOGRAPHY, DEFAULT_FONT } from '@/lib/themes'

export const DEFAULT_SEO: SeoSettings = {
  autoSchema: true,
  sitemap: true,
  llms: true,
  robots: true,
  rss: true,
  ogImage: true,
  ogFallbackImage: '',
}

export const DEFAULT_BACKUPS: BackupSettings = {
  enabled: false,
  intervalDays: 4,
  keep: 4,
}

export const DEFAULT_FEATURES: FeatureSettings = {
  search: true,
  toc: true,
  related: true,
  readingTime: true,
  progressBar: true,
  activityLog: true,
  sidebar: true,
  leadPost: true,
  categoryLabel: true,
  deck: true,
  bookText: false,
}

export const DEFAULT_COMMENTS: CommentSettings = {
  enabled: false,
  turnstile: false,
  googleAuth: false,
}

// Per-role type CSS vars on :root (+ optional font-smoothing). Injected after
// globals.css (same defaults), so a saved scale wins and a fresh install still works.
export function typographyToCss(t: TypographySettings): string {
  const vars = TYPE_ROLES.map((r) => {
    const s = t.roles[r]
    return `--fs-${r}:${s.size}rem;--lh-${r}:${s.line};--ls-${r}:${s.spacing}em`
  }).join(';')
  const smooth = t.smoothing ? `body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}` : ''
  return `:root{${vars}}${smooth}`
}

// Emit one @font-face per uploaded weight for the owner typeface and point
// --font-reading at it (Inter stays the fallback). Empty when no font is set.
export function fontToCss(f: FontSettings): string {
  if (!f.family || f.faces.length === 0) return ''
  const faces = f.faces
    .map((face) => {
      const fmt = fontFormat(face.url)
      const src = `url('${face.url}')${fmt ? ` format('${fmt}')` : ''}`
      return `@font-face{font-family:'${f.family}';font-weight:${face.weight};font-style:normal;src:${src};font-display:swap}`
    })
    .join('')
  // An uploaded custom font styles the reader's words (article, comments, editor),
  // matching the built-in fontPreset scope — the chrome stays Inter.
  return faces + `:root{--font-reading:'${f.family}', var(--font-inter)}`
}

export const DEFAULT_SETTINGS: SiteSettings = {
  language: 'en',
  title: 'Quire Blog',
  description: '',
  siteUrl: '',
  logoUrl: '',
  logoWidth: 120,
  logoRenderUrl: '',
  logoRenderHeight: 0,
  showLogo: false,
  showDescription: true,
  fontPreset: DEFAULT_FONT_PRESET,
  fontChromeInter: true,
  faviconUrl: '',
  appIconUrl: '',
  contentWidth: 672,
  postsPerPage: 10,
  relatedCount: 3,
  excerptLength: 50,
  customCss: '',
  footer: '© {year} {title} · [powered by Quire Blog](https://github.com/joiha-steven/Quire)',
  menu: [],
  themePreset: DEFAULT_PRESET_ID,
  enabledPalettes: ALL_PALETTE_IDS,
  themes: defaultThemes(),
  typography: DEFAULT_TYPOGRAPHY,
  customFont: DEFAULT_FONT,
  seo: DEFAULT_SEO,
  features: DEFAULT_FEATURES,
  comments: DEFAULT_COMMENTS,
  mcp: { enabled: false },
  motion: { enabled: true, typewriter: true },
  backups: DEFAULT_BACKUPS,
}

// Canonical base URL: owner value, else the SITE_URL env, else localhost.
export function resolveSiteUrl(s: SiteSettings): string {
  if (s.siteUrl) return s.siteUrl
  if (process.env.SITE_URL) return process.env.SITE_URL
  return 'http://localhost:3000'
}

// PWA / home-screen icon: app icon → favicon → bundled `/app-icon.png`.
export function resolveAppIcon(s: SiteSettings): string {
  return s.appIconUrl || s.faviconUrl || '/app-icon.png'
}

// Settings merged over defaults; defaults on any error. `React.cache` dedupes per
// render only, so a saved setting is live next request.
export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const { data: row } = await db().from('settings').select('data').eq('id', 1).maybeSingle()
    const stored = (row?.data ?? {}) as Partial<SiteSettings>
    const seo = sanitizeSeo(stored.seo, DEFAULT_SEO)
    // Expand store-relative image refs to absolute Blob URLs.
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      logoUrl: expandBlob(stored.logoUrl ?? DEFAULT_SETTINGS.logoUrl),
      logoRenderUrl: expandBlob(stored.logoRenderUrl ?? DEFAULT_SETTINGS.logoRenderUrl),
      faviconUrl: expandBlob(stored.faviconUrl ?? DEFAULT_SETTINGS.faviconUrl),
      appIconUrl: expandBlob(stored.appIconUrl ?? DEFAULT_SETTINGS.appIconUrl),
      siteUrl: sanitizeUrl(stored.siteUrl),
      relatedCount: clampNumber(stored.relatedCount, 0, 12, DEFAULT_SETTINGS.relatedCount),
      excerptLength: clampNumber(stored.excerptLength, 10, 100, DEFAULT_SETTINGS.excerptLength),
      customCss: sanitizeCss(stored.customCss),
      themePreset: isPresetId(stored.themePreset) ? stored.themePreset : DEFAULT_PRESET_ID,
      fontPreset: isFontPresetId(stored.fontPreset) ? stored.fontPreset : DEFAULT_FONT_PRESET,
      fontChromeInter: typeof stored.fontChromeInter === 'boolean' ? stored.fontChromeInter : true,
      enabledPalettes: sanitizeEnabledPalettes(stored.enabledPalettes, isPresetId(stored.themePreset) ? stored.themePreset : DEFAULT_PRESET_ID),
      themes: sanitizeThemes(stored.themes, migrateThemes(stored as Record<string, unknown>)),
      typography: sanitizeTypography(stored.typography, DEFAULT_TYPOGRAPHY),
      customFont: (() => {
        const f = sanitizeFont(stored.customFont, DEFAULT_FONT)
        return { ...f, faces: f.faces.map((x) => ({ ...x, url: expandBlob(x.url) })) }
      })(),
      seo: { ...seo, ogFallbackImage: expandBlob(seo.ogFallbackImage) },
      features: sanitizeFeatures(stored.features, DEFAULT_FEATURES),
      comments: sanitizeComments(stored.comments, DEFAULT_COMMENTS),
      mcp: sanitizeMcp(stored.mcp, DEFAULT_SETTINGS.mcp),
      motion: sanitizeMotion(stored.motion, DEFAULT_SETTINGS.motion),
      backups: sanitizeBackups(stored.backups, DEFAULT_BACKUPS),
    }
  } catch (error) {
    console.error(`[ERROR] settings.getSettings: ${(error as Error).message}`)
    return DEFAULT_SETTINGS
  }
})

// Merge a partial update over current settings and persist. Returns the result.
export async function saveSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings()

  // Logo: keep the original untouched; (re)build the small display WebP when the
  // source/width changes or none exists yet. Delete the prior derived file (one
  // ever exists); clear when logo removed/hidden. Vector/animated → null (served as-is).
  const showLogo = input.showLogo ?? current.showLogo
  const logoUrl = input.logoUrl ?? current.logoUrl
  const logoWidth = clampNumber(input.logoWidth, 24, 600, current.logoWidth)
  let logoRenderUrl = current.logoRenderUrl
  let logoRenderHeight = current.logoRenderHeight
  if (!showLogo || !logoUrl) {
    if (current.logoRenderUrl) await deleteByPathname(collapseBlob(current.logoRenderUrl)).catch(() => {})
    logoRenderUrl = ''
    logoRenderHeight = 0
  } else if (logoUrl !== current.logoUrl || logoWidth !== current.logoWidth || !current.logoRenderUrl) {
    const rendered = await renderLogo(logoUrl, logoWidth)
    if (current.logoRenderUrl) await deleteByPathname(collapseBlob(current.logoRenderUrl)).catch(() => {})
    logoRenderUrl = rendered?.url ?? ''
    logoRenderHeight = rendered?.height ?? 0
  }

  // The (possibly new) default palette — used both as `themePreset` and as the
  // always-included member of `enabledPalettes`.
  const themePreset = isPresetId(input.themePreset) ? input.themePreset : current.themePreset

  const next: SiteSettings = {
    language: isSiteLang(input.language) ? input.language : current.language,
    title: (input.title ?? current.title).trim() || DEFAULT_SETTINGS.title,
    description: input.description ?? current.description,
    siteUrl: input.siteUrl !== undefined ? sanitizeUrl(input.siteUrl) : current.siteUrl,
    logoUrl,
    logoWidth,
    logoRenderUrl,
    logoRenderHeight,
    showLogo,
    showDescription: input.showDescription ?? current.showDescription,
    faviconUrl: input.faviconUrl ?? current.faviconUrl,
    appIconUrl: input.appIconUrl ?? current.appIconUrl,
    contentWidth: clampNumber(input.contentWidth, 360, 1600, current.contentWidth),
    postsPerPage: clampNumber(input.postsPerPage, 1, 100, current.postsPerPage),
    relatedCount: clampNumber(input.relatedCount, 0, 12, current.relatedCount),
    excerptLength: clampNumber(input.excerptLength, 10, 100, current.excerptLength),
    customCss: input.customCss !== undefined ? sanitizeCss(input.customCss) : current.customCss,
    // Footer is rendered through renderInlineMarkdown (escape-first), so here we only
    // trim + cap length; markup safety is the renderer's job.
    footer: typeof input.footer === 'string' ? input.footer.slice(0, 600) : current.footer,
    menu: sanitizeMenu(input.menu, current.menu),
    themePreset,
    fontPreset: isFontPresetId(input.fontPreset) ? input.fontPreset : current.fontPreset,
    fontChromeInter: typeof input.fontChromeInter === 'boolean' ? input.fontChromeInter : current.fontChromeInter,
    enabledPalettes: sanitizeEnabledPalettes(input.enabledPalettes ?? current.enabledPalettes, themePreset),
    themes: sanitizeThemes(input.themes, current.themes),
    typography: sanitizeTypography(input.typography, current.typography),
    customFont: sanitizeFont(input.customFont, current.customFont),
    seo: sanitizeSeo(input.seo, current.seo),
    features: sanitizeFeatures(input.features, current.features),
    comments: sanitizeComments(input.comments, current.comments),
    mcp: sanitizeMcp(input.mcp, current.mcp),
    motion: sanitizeMotion(input.motion, current.motion),
    backups: sanitizeBackups(input.backups, current.backups),
  }
  // Persist image refs store-relative (collapse); keep `next` absolute for the client.
  const stored: SiteSettings = {
    ...next,
    logoUrl: collapseBlob(next.logoUrl),
    logoRenderUrl: collapseBlob(next.logoRenderUrl),
    faviconUrl: collapseBlob(next.faviconUrl),
    appIconUrl: collapseBlob(next.appIconUrl),
    customFont: { ...next.customFont, faces: next.customFont.faces.map((x) => ({ ...x, url: collapseBlob(x.url) })) },
    seo: { ...next.seo, ogFallbackImage: collapseBlob(next.seo.ogFallbackImage) },
  }
  await db().from('settings').upsert({ id: 1, data: stored })
  return next
}
