// Newsletter subscribers with double opt-in. A new address is 'pending' until it
// clicks the confirm link (token); only 'confirmed' addresses receive a broadcast.
// The token is a per-subscriber secret used for BOTH the confirm and unsubscribe
// links. SERVER-ONLY.

import { randomBytes } from 'node:crypto'
import { deleteSendsFor } from '@/news/newsletter-log'
import { all, one, run } from '@/store/query'
import { nowMs, toIso } from '@/store/db'

export type SubStatus = 'pending' | 'confirmed' | 'unsubscribed'
export type Subscriber = {
  id: number
  email: string
  status: SubStatus
  createdAt: string
  confirmedAt?: string
}

export class SubscribeError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const newToken = () => randomBytes(24).toString('base64url')

// Add or re-subscribe an address (idempotent by email). Returns the token for the
// opt-in link + whether it is ALREADY confirmed (so the caller can skip the email).
export async function addSubscriber(emailRaw: string): Promise<{ token: string; alreadyConfirmed: boolean }> {
  const email = emailRaw.trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) throw new SubscribeError('invalid_email')
  const row = one<{ status: SubStatus; token: string }>(
    `select status, token from subscribers where email = ?`, email,
  )
  if (row?.status === 'confirmed') return { token: row.token, alreadyConfirmed: true }
  const token = row?.token ?? newToken()
  // Re-subscribing after unsubscribing resets to 'pending', so the double opt-in is
  // walked again rather than silently re-enabling a removed address.
  run(
    `insert into subscribers (email, status, token, created_at, confirmed_at)
     values ($email, 'pending', $token, $now, null)
     on conflict(email) do update set
       status = 'pending', token = excluded.token, confirmed_at = null`,
    { email, token, now: nowMs() },
  )
  return { token, alreadyConfirmed: false }
}

// Confirm a pending subscriber by token. Returns true if a pending row was flipped.
export async function confirmSubscriber(token: string): Promise<boolean> {
  if (!token) return false
  return run(
    `update subscribers set status = 'confirmed', confirmed_at = ?
      where token = ? and status = 'pending'`,
    nowMs(), token,
  ).changes > 0
}

// Unsubscribe by token (from any state except already-unsubscribed).
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!token) return false
  return run(
    `update subscribers set status = 'unsubscribed'
      where token = ? and status != 'unsubscribed'`,
    token,
  ).changes > 0
}

// Confirmed recipients (email + token for the per-recipient unsubscribe link).
export async function getConfirmedSubscribers(): Promise<{ email: string; token: string }[]> {
  try {
    return all<{ email: string; token: string }>(
      `select email, token from subscribers where status = 'confirmed'`,
    )
  } catch (error) {
    console.error(`[ERROR] subscribers.getConfirmedSubscribers: ${(error as Error).message}`)
    return []
  }
}

// Admin list (newest first).
export async function listSubscribers(): Promise<Subscriber[]> {
  try {
    return all<{ id: number; email: string; status: SubStatus; created_at: number; confirmed_at: number | null }>(
      `select id, email, status, created_at, confirmed_at from subscribers
        order by created_at desc, id desc`,
    ).map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status,
      createdAt: toIso(r.created_at),
      confirmedAt: r.confirmed_at == null ? undefined : toIso(r.confirmed_at),
    }))
  } catch (error) {
    console.error(`[ERROR] subscribers.listSubscribers: ${(error as Error).message}`)
    return []
  }
}

export async function subscriberCounts(): Promise<{ confirmed: number; pending: number; unsubscribed: number }> {
  const all = await listSubscribers()
  return {
    confirmed: all.filter((s) => s.status === 'confirmed').length,
    pending: all.filter((s) => s.status === 'pending').length,
    unsubscribed: all.filter((s) => s.status === 'unsubscribed').length,
  }
}

// Hard delete (the admin's explicit remove). The send log is keyed by address, so it is
// cleared too — otherwise deleting a subscriber would leave their email on file.
export async function deleteSubscriber(id: number): Promise<void> {
  const row = one<{ email: string }>(`select email from subscribers where id = ?`, id)
  run(`delete from subscribers where id = ?`, id)
  if (row?.email) await deleteSendsFor(row.email)
}
