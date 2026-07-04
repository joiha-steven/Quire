// Content-type by file extension — shared by the local storage driver's serving
// route and the backup re-upload path. Extension-based on purpose: the local
// driver does not persist the upload content-type, so the type
// is always re-derived from the pathname, which is stable and unique.

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif',
  gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2',
  ttf: 'font/ttf', otf: 'font/otf', pdf: 'application/pdf',
}

export function mimeOf(pathname: string): string {
  const ext = pathname.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}
