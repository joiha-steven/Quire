// Tokened draft preview: renders a post/page regardless of status when the
// ?key= matches the slug's HMAC. Kept separate from /[slug] so the public route
// stays SSG and only ever shows published content. Never indexed or cached.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/posts'
import { getPage } from '@/lib/pages'
import { getSettings } from '@/lib/settings'
import { formatDate } from '@/lib/i18n'
import { PostContent } from '@/components/blog/PostContent'
import { verifyPreview } from '@/lib/preview'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function PreviewPage({ params, searchParams }: PageProps<'/preview/[slug]'>) {
  const { slug } = await params
  const { key } = await searchParams
  if (!verifyPreview(slug, typeof key === 'string' ? key : undefined)) notFound()

  const [post, page, { language }] = await Promise.all([getPost(slug), getPage(slug), getSettings()])
  const entry = post ?? page
  if (!entry) notFound()

  return (
    <article>
      <div className="mb-6 rounded-lg border border-rule bg-rule px-4 py-2 text-sm text-meta">
        Bản xem trước · trang này không công khai và không được lập chỉ mục.
      </div>
      <h1 className="fs-h1 font-bold tracking-tight">{entry.title}</h1>
      {post && <p className="mt-3 text-sm text-meta">{formatDate(post.date, language)}</p>}
      <div className="mt-8">
        <PostContent markdown={entry.content} />
      </div>
    </article>
  )
}
