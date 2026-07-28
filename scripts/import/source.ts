// The Quire 1.x side of the importer: reads the live instance over PostgREST with the
// existing service_role token.
//
// A DEV dependency (`@supabase/postgrest-js`) on purpose. Reading a backup archive would
// decouple the importer from a running database, but the archive format is itself
// something that would need porting and verifying, and v1 is running throughout the
// project anyway. Reading the source tables directly is also what makes the row-count
// verification meaningful: both sides are queried the same way.

import { PostgrestClient } from '@supabase/postgrest-js'

export type { SourceRow } from '@/import/write'
import type { SourceRow } from '@/import/write'

/** Every table read from v1, in the order 05-importer.md requires. */
export const SOURCE_TABLES = [
  'settings', 'integration_keys', 'backup_state',
  'pages', 'posts', 'post_revisions',
  'media', 'files',
  'comments',
  'subscribers', 'newsletter_sends',
  'redirects',
  'mcp_tokens', 'mcp_clients', 'mcp_used_codes',
  'activity_log',
] as const

export const ANALYTICS_TABLES = ['analytics_events', 'analytics_scroll'] as const

export type SourceTable = (typeof SOURCE_TABLES)[number] | (typeof ANALYTICS_TABLES)[number]

// PostgREST caps a response; 1,000 is its default and raising it server-side is not our
// call, so every read pages explicitly. A silent truncation here would import a partial
// site that passes nothing but looks plausible.
const PAGE = 1_000

export class Source {
  private client: PostgrestClient

  constructor(url: string, token: string) {
    this.client = new PostgrestClient(url, {
      headers: { apikey: token, authorization: `Bearer ${token}` },
    })
  }

  /** Every row of a table, paged, ordered by a stable key so paging cannot skip or repeat. */
  async readAll(table: SourceTable, orderBy: string): Promise<SourceRow[]> {
    const rows: SourceRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .order(orderBy, { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`read ${table}: ${error.message}`)
      const batch = (data ?? []) as SourceRow[]
      rows.push(...batch)
      if (batch.length < PAGE) return rows
    }
  }

  /** Exact row count, including soft-deleted rows (Tier 1 counts everything). */
  async count(table: SourceTable): Promise<number> {
    const { count, error } = await this.client.from(table).select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count ${table}: ${error.message}`)
    return count ?? 0
  }

  /** Rows carrying a `deleted_at`, for the Invariant 6 check in Tier 4. */
  async softDeletedCount(table: SourceTable): Promise<number> {
    const { count, error } = await this.client
      .from(table).select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null)
    if (error) throw new Error(`softDeleted ${table}: ${error.message}`)
    return count ?? 0
  }

  /** Analytics in batches, because it is the one table that can be genuinely large. */
  async *readBatched(table: SourceTable, batch: number): AsyncGenerator<SourceRow[]> {
    for (let from = 0; ; from += batch) {
      const { data, error } = await this.client
        .from(table).select('*').order('id', { ascending: true }).range(from, from + batch - 1)
      if (error) throw new Error(`read ${table}: ${error.message}`)
      const rows = (data ?? []) as SourceRow[]
      if (rows.length > 0) yield rows
      if (rows.length < batch) return
    }
  }
}

/** The column each table is ordered by when paging. */
export const ORDER_KEY: Record<string, string> = {
  settings: 'id', integration_keys: 'id', backup_state: 'id',
  pages: 'slug', posts: 'slug', post_revisions: 'id',
  media: 'path', files: 'url',
  comments: 'id',
  subscribers: 'id', newsletter_sends: 'id',
  redirects: 'id',
  mcp_tokens: 'id', mcp_clients: 'client_id', mcp_used_codes: 'jti',
  activity_log: 'id',
  analytics_events: 'id', analytics_scroll: 'id',
}
