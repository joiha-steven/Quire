// Small file store for site icons (favicon, app icon) kept OUT of the media
// library so they don't clutter the post-image grid. Uploaded under `files/` on
// Blob. Unlike media, `.ico` is accepted here (favicons are often .ico), and no
// variants/thumbnails are generated — the icon is stored verbatim.

import { uploadFile } from '@/lib/blob'

// contentType -> file extension. `.ico` arrives as x-icon / vnd.microsoft.icon
// (and occasionally a bare type), so it's matched explicitly.
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}

export function isAllowedIconType(contentType: string): boolean {
  return contentType in EXT
}

// Upload one icon and return its absolute URL. `kind` namespaces the stored name
// (favicon / app-icon); a timestamp keeps it unique so a replaced icon gets a
// fresh URL (busting the aggressive favicon cache) instead of overwriting.
export async function uploadIcon(kind: string, body: ArrayBuffer | Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType]
  if (!ext) throw new Error(`Unsupported icon type: ${contentType}`)
  const path = `files/${kind}-${Date.now()}.${ext}`
  return uploadFile(path, body, contentType)
}
