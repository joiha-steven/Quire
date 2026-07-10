// A list of post previews with an empty state. A faint rule separates cards.
import { Fragment } from 'react'
import type { Post, SiteLang } from '@/types'
import { PostCard } from './PostCard'

export function PostList({
  posts,
  lang,
  emptyText,
  showReadingTime = false,
  showCategory = false,
  lead = false, // page 1 of the home list: the newest post takes the h1 role
}: {
  posts: Post[]
  lang: SiteLang
  emptyText: string
  showReadingTime?: boolean
  showCategory?: boolean
  lead?: boolean
}) {
  if (posts.length === 0) {
    return <p className="py-16 text-center text-meta">{emptyText}</p>
  }
  return (
    <div className="flex flex-col gap-9">
      {posts.map((post, i) => (
        <Fragment key={post.slug}>
          {i > 0 && <hr />}
          <PostCard
            post={post}
            lang={lang}
            showReadingTime={showReadingTime}
            showCategory={showCategory}
            lead={lead && i === 0}
          />
        </Fragment>
      ))}
    </div>
  )
}
