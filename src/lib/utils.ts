// Pure helpers shared across lib and components. No side effects, no I/O.

// Convert arbitrary text to a URL-safe slug (supports Vietnamese diacritics).
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritic marks
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Format an ISO date as Vietnamese long form, e.g. "19 tháng 6, 2026".
export function formatDateVi(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}

// Terse date + 24h time for the admin tables, e.g. "4/6/26 - 14:05".
export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1}/${yy} - ${hh}:${mm}`
}

// Format an ISO date as "HH:mm" for the auto-save indicator.
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Max characters kept from an author-provided excerpt.
export const EXCERPT_MAX_CHARS = 200

// Strip markdown/HTML to plain text.
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/<[^>]+>/g, ' ') // html tags (e.g. video iframes)
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Auto excerpt: first `maxWords` words of the body, ending with "..." if cut.
export function deriveExcerpt(markdown: string, maxWords = 50): string {
  const plain = toPlainText(markdown)
  if (!plain) return ''
  const words = plain.split(' ')
  if (words.length <= maxWords) return plain
  return `${words.slice(0, maxWords).join(' ')}...`
}

// Clamp an author-provided excerpt to a character limit (cut on a word boundary).
export function clampExcerpt(text: string, maxChars = EXCERPT_MAX_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}...`
}

// Human-readable file size from bytes, e.g. "1.2 MB".
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

// Is this post visible on the public blog right now? Published + date reached.
export function isPublicallyVisible(status: string, isoDate: string): boolean {
  if (status !== 'published') return false
  const d = new Date(isoDate).getTime()
  if (Number.isNaN(d)) return true
  return d <= Date.now()
}
