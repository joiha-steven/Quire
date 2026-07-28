// Pure pagination helper shared by the home/category/tag lists.

export type Paged<T> = {
  items: T[]
  page: number // clamped current page (1-based)
  totalPages: number
}

// Parse a `/page/[n]` path segment. Returns the integer page only when it is a
// real deep page (>= 2); null for "1" or junk, so those URLs 404 (page 1 lives
// at the bare base path — no duplicate-content URL for it).
export function parsePathPage(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n >= 2 ? n : null
}

// Slice `all` into the requested page; clamps page into range.
export function paginate<T>(all: T[], page: number, perPage: number): Paged<T> {
  const totalPages = Math.max(1, Math.ceil(all.length / perPage))
  const current = Math.min(Math.max(1, page), totalPages)
  const start = (current - 1) * perPage
  return { items: all.slice(start, start + perPage), page: current, totalPages }
}
