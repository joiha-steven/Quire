// Newsletter subscribers with double opt-in. A new address is 'pending' until it
// clicks the confirm link (token); only 'confirmed' addresses receive a broadcast.
// The token is a per-subscriber secret used for BOTH the confirm and unsubscribe
// links. SERVER-ONLY.

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

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
  const { data: existing } = await db()
    .from('subscribers')
    .select('status,token')
    .eq('email', email)
    .maybeSingle()
  const row = existing as { status: SubStatus; token: string } | null
  if (row?.status === 'confirmed') return { token: row.token, alreadyConfirmed: true }
  const token = row?.token ?? newToken()
  const { error } = await db()
    .from('subscribers')
    .upsert({ email, status: 'pending', token, confirmed_at: null }, { onConflict: 'email' })
  if (error) throw new Error(`addSubscriber: ${error.message}`)
  return { token, alreadyConfirmed: false }
}

// Confirm a pending subscriber by token. Returns true if a pending row was flipped.
export async function confirmSubscriber(token: string): Promise<boolean> {
  if (!token) return false
  const { data } = await db()
    .from('subscribers')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('token', token)
    .eq('status', 'pending')
    .select('id')
  return Array.isArray(data) && data.length > 0
}

// Unsubscribe by token (from any state except already-unsubscribed).
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!token) return false
  const { data } = await db()
    .from('subscribers')
    .update({ status: 'unsubscribed' })
    .eq('token', token)
    .neq('status', 'unsubscribed')
    .select('id')
  return Array.isArray(data) && data.length > 0
}

// Confirmed recipients (email + token for the per-recipient unsubscribe link).
export async function getConfirmedSubscribers(): Promise<{ email: string; token: string }[]> {
  const { data, error } = await db().from('subscribers').select('email,token').eq('status', 'confirmed')
  if (error || !data) return []
  return data as { email: string; token: string }[]
}

// Admin list (newest first).
export async function listSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await db()
    .from('subscribers')
    .select('id,email,status,created_at,confirmed_at')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as { id: number; email: string; status: SubStatus; created_at: string; confirmed_at: string | null }[]).map(
    (r) => ({ id: r.id, email: r.email, status: r.status, createdAt: r.created_at, confirmedAt: r.confirmed_at ?? undefined }),
  )
}

export async function subscriberCounts(): Promise<{ confirmed: number; pending: number; unsubscribed: number }> {
  const all = await listSubscribers()
  return {
    confirmed: all.filter((s) => s.status === 'confirmed').length,
    pending: all.filter((s) => s.status === 'pending').length,
    unsubscribed: all.filter((s) => s.status === 'unsubscribed').length,
  }
}

export async function deleteSubscriber(id: number): Promise<void> {
  const { error } = await db().from('subscribers').delete().eq('id', id)
  if (error) throw new Error(`deleteSubscriber: ${error.message}`)
}
