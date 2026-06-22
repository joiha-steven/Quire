import { describe, it, expect } from 'vitest'
import { videoEmbed, isVideoUrl } from '@/lib/video'

describe('videoEmbed', () => {
  it('maps a YouTube watch URL to a nocookie embed', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'youtube',
      embed: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    })
  })

  it('maps a youtu.be short link too', () => {
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ')?.embed).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
  })

  it('maps a Vimeo URL to a player embed', () => {
    expect(videoEmbed('https://vimeo.com/123456789')).toEqual({
      kind: 'vimeo',
      embed: 'https://player.vimeo.com/video/123456789',
    })
  })

  it('maps a TikTok video URL to an embed', () => {
    expect(videoEmbed('https://www.tiktok.com/@user/video/7234567890123456789')?.kind).toBe(
      'tiktok',
    )
  })

  it('returns null for a non-video URL', () => {
    expect(videoEmbed('https://example.com/article')).toBeNull()
    expect(isVideoUrl('https://example.com/article')).toBe(false)
  })
})
