// Pure pagination helper shared by the home/category/tag lists.

export type Paged<T> = {
  items: T[]
  page: number // clamped current page (1-based)
  totalPages: number
}

// Parse a ?page= value into a positive integer (defaults to 1).
export function parsePage(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

// Slice `all` into the requested page; clamps page into range.
export function paginate<T>(all: T[], page: number, perPage: number): Paged<T> {
  const totalPages = Math.max(1, Math.ceil(all.length / perPage))
  const current = Math.min(Math.max(1, page), totalPages)
  const start = (current - 1) * perPage
  return { items: all.slice(start, start + perPage), page: current, totalPages }
}
