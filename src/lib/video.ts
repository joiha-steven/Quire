// Recognize a standalone video URL (YouTube / Vimeo / TikTok) and compute its
// embed URL. Videos are stored in content as a plain URL on its own line, so the
// blog stays 100% Markdown; the renderer turns known URLs into responsive
// embeds. Shared by the public renderer and the editor's Video node.
export type VideoKind = 'youtube' | 'vimeo' | 'tiktok'

export function videoEmbed(url: string): { kind: VideoKind; embed: string } | null {
  const u = url.trim()
  let m: RegExpMatchArray | null
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)))
    return { kind: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${m[1]}` }
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
    return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}` }
  if ((m = u.match(/tiktok\.com\/.*\/video\/(\d+)/)))
    return { kind: 'tiktok', embed: `https://www.tiktok.com/embed/v2/${m[1]}` }
  return null
}

export const isVideoUrl = (s: string): boolean => videoEmbed(s) !== null

// A DIRECT video file (self-hosted upload from the Library's Videos tab, or any
// absolute .mp4/.webm URL) — rendered as a native <video> player instead of an
// iframe embed. Only http(s)/root-relative URLs qualify, so a javascript:/data:
// scheme can never reach a src attribute through this path.
const VIDEO_FILE = /\.(mp4|m4v|webm|mov)(?:[?#]|$)/i

export function videoFileUrl(url: string): string | null {
  const u = url.trim()
  if (!/^(https?:\/\/|\/)/i.test(u)) return null
  return VIDEO_FILE.test(u) ? u : null
}

// Classify a Library attachment as a video — splits the shared `files` store into
// the Videos tab (players) vs the Files tab (everything else).
export function isVideoAttachment(filename: string, contentType: string): boolean {
  return contentType.startsWith('video/') || VIDEO_FILE.test(filename)
}
