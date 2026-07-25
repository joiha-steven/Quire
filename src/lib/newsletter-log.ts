// Newsletter send log (`newsletter_sends`): ONE row per outgoing email, written by
// `sendMail` so nothing can send without being recorded. Keyed by email address, not a
// subscriber id — reply notifications go to commenters who never subscribed.
//
// Open tracking (broadcast only): each broadcast row carries an unguessable
// `open_token`; the email embeds a 1x1 pixel pointing at `/api/newsletter/open?t=`.
// The token identifies the SEND, never the address, so the URL leaks nothing on its own
// and an open is recorded ONCE (first hit wins — mail clients refetch).
// SERVER-ONLY.

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

export type SendKind = 'confirm' | 'broadcast' | 'reply' | 'test'

export type SendStats = {
  sent: number // successful sends
  failed: number
  opened: number // broadcasts recorded as opened
  broadcasts: number // successful broadcasts (the open-rate denominator)
  lastAt?: string
  lastError?: string
}

const EMPTY: SendStats = { sent: 0, failed: 0, opened: 0, broadcasts: 0 }

export const newOpenToken = (): string => randomBytes(18).toString('base64url')

// Record one send. NEVER throws: a logging failure must not fail (or double-send) the
// mail that already went out.
export async function logSend(row: {
  email: string
  kind: SendKind
  ok: boolean
  postSlug?: string
  error?: string
  openToken?: string
}): Promise<void> {
  try {
    await db().from('newsletter_sends').insert({
      email: row.email.trim().toLowerCase(),
      kind: row.kind,
      post_slug: row.postSlug ?? null,
      ok: row.ok,
      error: row.error ?? null,
      // Only a delivered broadcast can be opened; don't burn a token on a failed send.
      open_token: row.ok && row.kind === 'broadcast' ? (row.openToken ?? null) : null,
    })
  } catch (error) {
    console.error(`[ERROR] newsletter-log.logSend: ${(error as Error).message}`)
  }
}

type Row = { email: string; kind: SendKind; ok: boolean; sent_at: string; error: string | null; opened_at: string | null }

// Per-address rollup for the subscriber table. One read + a fold, not a query per row.
export async function statsByEmail(): Promise<Map<string, SendStats>> {
  const out = new Map<string, SendStats>()
  const { data, error } = await db()
    .from('newsletter_sends')
    .select('email,kind,ok,sent_at,error,opened_at')
    .order('sent_at', { ascending: true })
  if (error || !data) return out
  for (const r of data as Row[]) {
    const cur = out.get(r.email) ?? { ...EMPTY }
    if (r.ok) cur.sent++
    else {
      cur.failed++
      cur.lastError = r.error ?? undefined
    }
    if (r.ok && r.kind === 'broadcast') {
      cur.broadcasts++
      if (r.opened_at) cur.opened++
    }
    cur.lastAt = r.sent_at // rows arrive oldest-first, so the last write wins
    out.set(r.email, cur)
  }
  return out
}

// Per-post rollup, used by the send tab to show what a post has already been through.
export async function statsByPost(): Promise<Map<string, SendStats>> {
  const out = new Map<string, SendStats>()
  const { data, error } = await db()
    .from('newsletter_sends')
    .select('post_slug,ok,sent_at,error,opened_at')
    .eq('kind', 'broadcast')
    .order('sent_at', { ascending: true })
  if (error || !data) return out
  for (const r of data as (Row & { post_slug: string | null })[]) {
    if (!r.post_slug) continue
    const cur = out.get(r.post_slug) ?? { ...EMPTY }
    if (r.ok) {
      cur.sent++
      cur.broadcasts++
      if (r.opened_at) cur.opened++
    } else {
      cur.failed++
      cur.lastError = r.error ?? undefined
    }
    cur.lastAt = r.sent_at
    out.set(r.post_slug, cur)
  }
  return out
}

// Stamp an open. First hit wins (`is('opened_at', null)`) so a mail client refetching
// the pixel can't inflate the count. Silent no-op on an unknown/blank token.
export async function recordOpen(token: string): Promise<void> {
  if (!token) return
  try {
    await db()
      .from('newsletter_sends')
      .update({ opened_at: new Date().toISOString() })
      .eq('open_token', token)
      .is('opened_at', null)
  } catch (error) {
    console.error(`[ERROR] newsletter-log.recordOpen: ${(error as Error).message}`)
  }
}

// Drop an address's history when its subscriber row is deleted (the admin's delete is
// a real delete, so leaving the log behind would keep the address on file).
export async function deleteSendsFor(email: string): Promise<void> {
  try {
    await db().from('newsletter_sends').delete().eq('email', email.trim().toLowerCase())
  } catch (error) {
    console.error(`[ERROR] newsletter-log.deleteSendsFor: ${(error as Error).message}`)
  }
}
