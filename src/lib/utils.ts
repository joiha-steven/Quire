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

// Format an ISO date as "HH:mm" for the auto-save indicator.
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Derive a plain-text excerpt from markdown: first non-empty paragraph, trimmed.
export function deriveExcerpt(markdown: string, maxLen = 200): string {
  const firstPara =
    markdown
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p.length > 0) ?? ''
  const plain = firstPara
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[#>*_`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > maxLen ? `${plain.slice(0, maxLen).trim()}...` : plain
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
