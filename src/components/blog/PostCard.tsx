// Single post preview used in lists.
import Link from 'next/link'
import type { Post } from '@/types'
import { formatDateVi } from '@/lib/utils'

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="border-b border-neutral-200 pb-8">
      <h2 className="text-2xl font-bold tracking-tight">
        <Link href={`/${post.slug}`} className="hover:text-neutral-600">
          {post.title}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-neutral-500">{formatDateVi(post.date)}</p>
      {post.excerpt && <p className="mt-3 text-neutral-700">{post.excerpt}</p>}
      {post.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.categories.map((c) => (
            <Link
              key={c}
              href={`/category/${encodeURIComponent(c)}`}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
            >
              {c}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
