import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Next cache boundary — these throw outside a request scope and are the
// exact seam we want to observe (which paths/tags each purge emits).
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { revalidatePath, revalidateTag } from 'next/cache'
import {
  revalidateNewPost,
  revalidatePost,
  revalidatePage,
  revalidateEverything,
} from '@/lib/revalidate'

const paths = () => vi.mocked(revalidatePath).mock.calls
// All list/taxonomy/feed surfaces a post change must refresh (the SUPERSET).
const LIST_SURFACES: Array<[string, string?]> = [
  ['/'],
  ['/page/[n]', 'page'],
  ['/category/[slug]', 'page'],
  ['/category/[slug]/page/[n]', 'page'],
  ['/tag/[slug]', 'page'],
  ['/tag/[slug]/page/[n]', 'page'],
  ['/feed.xml'],
  ['/sitemap.xml'],
  ['/llms.txt'],
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('revalidate is a SUPERSET of the affected surfaces', () => {
  it('freshens the DB tag before any path purge (revalidateTag db, max)', () => {
    revalidateNewPost()
    expect(revalidateTag).toHaveBeenCalledWith('db', 'max')
  })

  it('a new post purges every list/taxonomy/feed surface', () => {
    revalidateNewPost()
    for (const surface of LIST_SURFACES) {
      expect(revalidatePath).toHaveBeenCalledWith(...surface)
    }
  })

  it('editing a post purges its own /slug AND all list surfaces', () => {
    revalidatePost('my-post')
    expect(revalidatePath).toHaveBeenCalledWith('/my-post')
    for (const surface of LIST_SURFACES) {
      expect(revalidatePath).toHaveBeenCalledWith(...surface)
    }
  })

  it('renaming a post purges BOTH the old and new slug paths', () => {
    revalidatePost('new-slug', 'old-slug')
    expect(revalidatePath).toHaveBeenCalledWith('/new-slug')
    expect(revalidatePath).toHaveBeenCalledWith('/old-slug')
  })

  it('does not re-purge the old slug when it equals the new slug', () => {
    revalidatePost('same', 'same')
    const slugCalls = paths().filter((c) => c[0] === '/same')
    expect(slugCalls).toHaveLength(1)
  })

  it('a page purges only its own URL + sitemap + llms, not the post lists', () => {
    revalidatePage('about')
    expect(revalidatePath).toHaveBeenCalledWith('/about')
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml')
    expect(revalidatePath).toHaveBeenCalledWith('/llms.txt')
    // A page is standalone — it must NOT churn the home/taxonomy list surfaces.
    expect(revalidatePath).not.toHaveBeenCalledWith('/')
    expect(revalidatePath).not.toHaveBeenCalledWith('/category/[slug]', 'page')
    expect(revalidatePath).not.toHaveBeenCalledWith('/feed.xml')
  })

  it('a settings change purges the whole site under the root layout', () => {
    revalidateEverything()
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(revalidateTag).toHaveBeenCalledWith('db', 'max')
  })
})
