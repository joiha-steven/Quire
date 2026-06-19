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
