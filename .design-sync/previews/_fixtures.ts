// Shared preview data. Not a preview itself — the converter only looks for
// `previews/<ComponentName>.tsx`, so this file is invisible to it and exists purely to stop
// twenty previews each inventing their own posts.
//
// `SETTINGS` is the product's real `DEFAULT_SETTINGS`, serialised at build time by
// `gen-styles.ts` (a preview cannot import `@/content/settings` directly — that module
// reaches sharp, which requires child_process, and previews are browser code).
//
// Everything else is composed fixture data. Realistic on purpose: these cards are browsed by
// humans and imitated by the design agent, so "foo / bar" would teach it the wrong thing
// about how a Quire Ink screen reads.
import SETTINGS_JSON from '../generated/settings.json'

export const SETTINGS: any = SETTINGS_JSON

export const POSTS: any[] = [
  {
    title: 'Bàn phím cơ và chuyện gõ tiếng Việt',
    slug: 'ban-phim-co-va-go-tieng-viet',
    date: '2026-07-28T09:00:00.000Z',
    status: 'published',
    categories: ['Bàn phím'],
    tags: ['telex', 'firmware'],
    excerpt: 'Bộ gõ nào cũng phải chọn giữa tốc độ và độ chính xác. Đây là chỗ tôi dừng lại.',
    readingMinutes: 8,
  },
  {
    title: 'What a static blog gives up, and what it buys',
    slug: 'what-a-static-blog-gives-up',
    date: '2026-07-14T11:30:00.000Z',
    status: 'published',
    categories: ['Engineering'],
    tags: ['bun', 'sqlite'],
    excerpt: 'Dropping the database was the easy part. Keeping the writing experience was not.',
    readingMinutes: 12,
  },
  {
    title: 'Notes on measuring a page instead of guessing',
    slug: 'measuring-a-page',
    date: '2026-08-04T08:00:00.000Z',
    status: 'draft',
    categories: ['Engineering'],
    tags: ['performance'],
    excerpt: 'Every performance argument I have lost was lost to someone with numbers.',
    readingMinutes: 5,
  },
]

export const PAGES: any[] = [
  { title: 'About', slug: 'about', status: 'published' },
  { title: 'Colophon', slug: 'colophon', status: 'published' },
  { title: 'Now', slug: 'now', status: 'draft' },
]

// Views are keyed by PATH; comment counts by bare slug. The two really do differ.
export const VIEWS: Record<string, number> = {
  '/ban-phim-co-va-go-tieng-viet': 4218,
  '/what-a-static-blog-gives-up': 1907,
  '/measuring-a-page': 0,
  '/about': 612,
  '/colophon': 88,
}

export const COMMENT_COUNTS: Record<string, number> = {
  'ban-phim-co-va-go-tieng-viet': 12,
  'what-a-static-blog-gives-up': 3,
  'measuring-a-page': 0,
}

export const COMMENTS: any[] = [
  {
    id: 1,
    postSlug: 'ban-phim-co-va-go-tieng-viet',
    author: 'Ngọc Anh',
    email: 'ngocanh@example.com',
    body: 'Mình dùng Telex nhiều năm rồi, chưa bao giờ nghĩ tới chuyện đo tốc độ thật. Bài này thuyết phục.',
    createdAt: '2026-07-29T03:12:00.000Z',
    status: 'approved',
  },
  {
    id: 2,
    postSlug: 'what-a-static-blog-gives-up',
    author: 'Marcus',
    email: 'marcus@example.com',
    body: 'Curious how this holds up once you have a few thousand posts. Any numbers?',
    createdAt: '2026-07-16T18:44:00.000Z',
    status: 'pending',
  },
  {
    id: 3,
    postSlug: 'what-a-static-blog-gives-up',
    author: 'buy-cheap-now',
    email: 'spam@example.com',
    body: 'CHECK OUT MY SITE!!! best deals guaranteed',
    createdAt: '2026-07-17T02:01:00.000Z',
    status: 'spam',
  },
]

export const ACTIVITY: any[] = [
  { at: '2026-08-01T09:14:00.000Z', action: 'post.publish', detail: 'ban-phim-co-va-go-tieng-viet' },
  { at: '2026-08-01T08:52:00.000Z', action: 'settings.save', detail: 'appearance' },
  { at: '2026-07-31T21:30:00.000Z', action: 'media.upload', detail: 'keyboard-hero.jpg' },
  { at: '2026-07-31T20:11:00.000Z', action: 'comment.approve', detail: '#1' },
]

// Bar rows for the analytics lists: `{ label, value }` with an optional href.
export const BAR_ROWS: any[] = [
  { label: '/ban-phim-co-va-go-tieng-viet', value: 4218 },
  { label: '/what-a-static-blog-gives-up', value: 1907 },
  { label: '/about', value: 612 },
  { label: '/colophon', value: 88 },
]

export const REFERRERS: any[] = [
  { label: 'google.com', value: 2841 },
  { label: 'news.ycombinator.com', value: 1663 },
  { label: 'x.com', value: 402 },
  { label: '(direct)', value: 1319 },
]
