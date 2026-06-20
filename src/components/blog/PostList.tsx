// A list of post previews with an empty state. A faint 50% rule separates cards.
import { Fragment } from 'react'
import type { Post, SiteLang } from '@/types'
import { PostCard } from './PostCard'

export function PostList({
  posts,
  lang,
  emptyText,
  showReadingTime = false,
}: {
  posts: Post[]
  lang: SiteLang
  emptyText: string
  showReadingTime?: boolean
}) {
  if (posts.length === 0) {
    return <p className="py-16 text-center text-neutral-500">{emptyText}</p>
  }
  return (
    <div className="flex flex-col gap-8">
      {posts.map((post, i) => (
        <Fragment key={post.slug}>
          {i > 0 && <hr />}
          <PostCard post={post} lang={lang} showReadingTime={showReadingTime} />
        </Fragment>
      ))}
    </div>
  )
}
