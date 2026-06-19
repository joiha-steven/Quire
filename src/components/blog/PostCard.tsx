// Single post preview used in lists.
import Link from 'next/link'
import type { Post, SiteLang } from '@/types'
import { formatDate } from '@/lib/i18n'

export function PostCard({ post, lang }: { post: Post; lang: SiteLang }) {
  return (
    <article className="border-b border-neutral-200 pb-8 dark:border-neutral-800">
      <h2 className="text-2xl font-bold tracking-tight">
        <Link href={`/${post.slug}`} className="hover:text-neutral-600 dark:hover:text-neutral-300">
          {post.title}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-meta">{formatDate(post.date, lang)}</p>
      {post.excerpt && (
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-neutral-600 dark:text-neutral-300">
          {post.excerpt}
        </p>
      )}
      {post.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.categories.map((c) => (
            <Link
              key={c}
              href={`/category/${encodeURIComponent(c)}`}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              {c}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
