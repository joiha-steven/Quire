// Post detail. Drafts and future-dated posts are not publicly reachable.
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { formatDate } from '@/lib/i18n'
import { PostContent } from '@/components/blog/PostContent'
import { isPublicallyVisible } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PostPage({ params }: PageProps<'/[slug]'>) {
  const { slug } = await params
  const [post, { language }] = await Promise.all([getPost(slug), getSettings()])
  if (!post || !isPublicallyVisible(post.status, post.date)) notFound()

  const full = post.imageDisplay === 'full' && post.featuredImage

  return (
    <article>
      {full && (
        <div className="relative left-1/2 mb-8 w-screen -translate-x-1/2">
          {/* Full-bleed image: use a plain img to span the viewport at native size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.featuredImage} alt={post.title} className="h-auto w-full" />
        </div>
      )}

      <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
      <p className="mt-2 text-sm text-neutral-500">{formatDate(post.date, language)}</p>

      {(post.categories.length > 0 || post.tags.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.categories.map((c) => (
            <Link
              key={`c-${c}`}
              href={`/category/${encodeURIComponent(c)}`}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
            >
              {c}
            </Link>
          ))}
          {post.tags.map((t) => (
            <Link
              key={`t-${t}`}
              href={`/tag/${encodeURIComponent(t)}`}
              className="rounded-full px-3 py-1 text-xs text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-50"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {!full && post.featuredImage && (
        <Image
          src={post.featuredImage}
          alt={post.title}
          width={1280}
          height={720}
          className="mt-8 h-auto w-full rounded-lg"
          unoptimized
        />
      )}

      <div className="mt-8">
        <PostContent markdown={post.content} />
      </div>
    </article>
  )
}
