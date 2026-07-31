// Seed a throwaway database with one post and a comment thread, so the comment section can
// be photographed instead of reasoned about.
//
// The thread is fetched by an island and never server-rendered, so a screenshot of the live
// markup is the only way to judge it. This builds the exact state the screenshot needs:
// a published post, a top-level comment, and a reply, with Google sign-in and Turnstile
// switched ON because that is the configuration the owner is looking at.
//
// Throwaway on purpose. `.tmp-drive-data/` is gitignored and this script recreates it.

import { rmSync } from 'node:fs'
import { openDatabases } from '@/store/db'
import { savePost } from '@/content/posts'
import { addComment } from '@/comments/comments'
import { saveSettings, getSettings } from '@/content/settings'

const DIR = process.argv[2] ?? './.tmp-drive-data'

rmSync(DIR, { recursive: true, force: true })
openDatabases(DIR)

await savePost({
  title: 'Ai cũng AI, nhà nhà AI',
  slug: 'ai-cung-ai',
  status: 'published',
  date: '2026-06-20T00:00:00.000Z',
  content: 'Một bài viết ngắn để chụp phần bình luận bên dưới.\n\nĐoạn thứ hai, cho có chiều cao.',
})

const settings = await getSettings()
// IDE chrome ON: it is what the live site runs, and it is the layer that puts the `//` on a
// label and the brackets around a date. Photographing without it shows a page nobody sees.
await saveSettings({
  ...settings,
  ideChrome: true,
  comments: { ...settings.comments, enabled: true, googleAuth: true, turnstile: true },
})

const top = await addComment({
  postSlug: 'ai-cung-ai',
  parentId: null,
  name: 'hungnguyenbmt82',
  email: 'reader@example.com',
  website: '',
  provider: 'manual',
  content: 'Một trong những vấn đề thực tế mà bài này nói tới là ai cũng AI, nhà nhà AI, người '
    + 'người AI, đốt tiền cho account từ chục đô, trăm đô tới API ngàn đô... mà **không phải ai '
    + 'cũng tạo ra được tiền từ AI**.',
  ip: '',
  country: 'VN',
})

await addComment({
  postSlug: 'ai-cung-ai',
  parentId: top.id,
  name: 'Trần Mạnh Hùng',
  email: 'owner@example.com',
  website: '',
  provider: 'manual',
  content: 'Theo mình thì AI đang rất tiện lợi cho rất nhiều doanh nghiệp và cá nhân, trong đó có mình.',
  ip: '',
  country: 'VN',
})

console.log(`seeded ${DIR}: /ai-cung-ai`)
