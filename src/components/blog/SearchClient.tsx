'use client'

// Client-side search: the full published-post index is passed in from the server
// and filtered in memory (accent-insensitive) over title/excerpt/tags/categories.
import { useMemo, useState } from 'react'
import type { Post, SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { foldAccents } from '@/lib/utils'
import { PostList } from './PostList'

export function SearchClient({ posts, lang, initialQuery }: { posts: Post[]; lang: SiteLang; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery)

  const results = useMemo(() => {
    const needle = foldAccents(q.trim())
    if (!needle) return posts
    return posts.filter((p) =>
      foldAccents([p.title, p.excerpt ?? '', p.tags.join(' '), p.categories.join(' ')].join(' ')).includes(needle),
    )
  }, [q, posts])

  return (
    <div>
      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t(lang).searchPlaceholder}
        aria-label={t(lang).search}
        className="mb-10 w-full border-b border-[var(--c-rule)] bg-transparent pb-3 text-2xl tracking-tight outline-none placeholder:text-meta"
      />
      <PostList posts={results} lang={lang} emptyText={t(lang).searchEmpty} />
    </div>
  )
}
