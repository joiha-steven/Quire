// Single post preview used in lists.
import Link from 'next/link'
import type { Post, SiteLang } from '@/types'
import { formatDate } from '@/lib/i18n'

export function PostCard({ post, lang }: { post: Post; lang: SiteLang }) {
  return (
    <article>
      <h2 className="text-[1.35rem] font-semibold tracking-tight">
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
    </article>
  )
}
