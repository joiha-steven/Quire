'use client'

// Unified content dashboard: tabs to switch between Posts and Pages, each with
// its own "new" button. Replaces the old status-filter tabs.
import { useState } from 'react'
import Link from 'next/link'
import type { Post, Page } from '@/types'
import { Button } from '@/components/ui/Button'
import { PostsTable } from './PostsTable'
import { PagesTable } from './PagesTable'
import { TaxonomyManager } from './TaxonomyManager'
import { useAdminT } from './I18nProvider'

type Tab = 'posts' | 'pages' | 'taxonomy'

export function ContentDashboard({
  posts,
  pages,
  views,
  commentCounts,
  commentsEnabled,
}: {
  posts: Post[]
  pages: Page[]
  views: Record<string, number>
  commentCounts: Record<string, number>
  commentsEnabled: boolean
}) {
  const t = useAdminT()
  const [tab, setTab] = useState<Tab>('posts')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'posts', label: t.tabPosts },
    { key: 'pages', label: t.tabPages },
    { key: 'taxonomy', label: t.tabTaxonomy },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.dashboardTitle}</h1>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === item.key
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-500'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab !== 'taxonomy' && (
          <Link href={tab === 'posts' ? '/admin/editor' : '/admin/page-editor'}>
            <Button>{tab === 'posts' ? t.newPost : t.newPage}</Button>
          </Link>
        )}
      </div>

      {tab === 'posts' && (
        <PostsTable initialPosts={posts} views={views} commentCounts={commentCounts} commentsEnabled={commentsEnabled} />
      )}
      {tab === 'pages' && <PagesTable initialPages={pages} views={views} />}
      {tab === 'taxonomy' && <TaxonomyManager posts={posts} />}
    </div>
  )
}
