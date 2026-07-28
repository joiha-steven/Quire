// A list of post previews with an empty state. Cards are separated by whitespace.
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
  // No rules between cards: whitespace does the separating, so the gap has to be
  // wide enough to read as a break rather than a paragraph space. `post-list` is the
  // hook the header Grid toggle switches to a CSS grid (globals.css + rail-css).
  return (
    <div className="post-list flex flex-col gap-16">
      {posts.map((post, i) => (
        <PostCard
          key={post.slug}
          post={post}
          lang={lang}
          showReadingTime={showReadingTime}
          showCategory={showCategory}
          lead={lead && i === 0}
        />
      ))}
    </div>
  )
}
