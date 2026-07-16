// Parse a single-range `Range: bytes=start-end` header against a known file size
// (RFC 9110 §14). Video playback depends on this: browsers seek (and iOS Safari
// refuses to play at all) via byte-range requests. Multi-range requests are rare
// from media players and legally answerable with the full body, so they return
// null (caller sends 200) rather than a multipart response.
export type ByteRange = { start: number; end: number } // inclusive, 0-based

// null = no/ignorable Range header → serve the full body (200).
// 'invalid' = unsatisfiable (start beyond EOF) → 416 with Content-Range: bytes */size.
export function parseRange(header: string | null, size: number): ByteRange | null | 'invalid' {
  if (!header || size <= 0) return null
  const m = header.match(/^bytes=(\d*)-(\d*)$/)
  if (!m) return null // malformed or multi-range → full body is a valid response
  const [, rawStart, rawEnd] = m
  if (rawStart === '' && rawEnd === '') return null
  if (rawStart === '') {
    // Suffix form `bytes=-N`: the final N bytes.
    const n = Number(rawEnd)
    if (n === 0) return 'invalid'
    return { start: Math.max(0, size - n), end: size - 1 }
  }
  const start = Number(rawStart)
  if (start >= size) return 'invalid'
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  if (end < start) return 'invalid'
  return { start, end }
}
