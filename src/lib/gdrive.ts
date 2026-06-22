// Google Drive REST helpers for the backup feature — SERVER-ONLY. Reuses the same
// Google OAuth client as sign-in (AUTH_GOOGLE_ID/SECRET) but with its OWN consent
// flow (scope `drive.file`, offline) so the login flow is untouched. `drive.file`
// limits access to files this app creates — it can never see the rest of the Drive.

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SiteSettings } from '@/types'
import { resolveSiteUrl } from '@/lib/settings'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'

// The OAuth redirect URI, derived from the canonical site URL so it is stable and
// matches the single URI registered on the Google client — independent of which host
// (custom domain vs *.vercel.app) the admin is being reached from.
export function backupRedirectUri(settings: SiteSettings): string {
  return `${resolveSiteUrl(settings)}/api/backup/callback`
}
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FOLDER_NAME = 'vibeblog-backups'

function creds(): { id: string; secret: string } {
  const id = process.env.AUTH_GOOGLE_ID
  const secret = process.env.AUTH_GOOGLE_SECRET
  if (!id || !secret) throw new Error('Missing AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET')
  return { id, secret }
}

// CSRF state: HMAC(timestamp) signed with AUTH_SECRET, valid for 10 minutes. The
// callback recomputes it so a forged redirect without a fresh signed state fails.
const stateSecret = (): string => process.env.AUTH_SECRET || ''

export function signState(): string {
  const ts = Date.now().toString()
  const sig = createHmac('sha256', stateSecret()).update(ts).digest('base64url')
  return `${ts}.${sig}`
}

export function verifyState(state: string): boolean {
  const [ts, sig] = (state || '').split('.')
  if (!ts || !sig) return false
  const expected = createHmac('sha256', stateSecret()).update(ts).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  return Date.now() - Number(ts) < 10 * 60 * 1000
}

// Consent URL for the one-time "Connect Google Drive" flow. `state` is an opaque
// CSRF/redirect guard the callback verifies.
export function consentUrl(redirectUri: string, state: string): string {
  const { id } = creds()
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token even on re-consent
    state,
  })
  return `${AUTH_URL}?${p}`
}

// Exchange the consent code for tokens; returns the long-lived refresh token.
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const { id, secret } = creds()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const json = (await res.json()) as { refresh_token?: string; error?: string }
  if (!res.ok || !json.refresh_token) throw new Error(`exchangeCode: ${json.error ?? res.status} (no refresh_token — revoke prior grant and retry)`)
  return json.refresh_token
}

// Trade a refresh token for a short-lived access token (each backup run).
export async function accessToken(refreshToken: string): Promise<string> {
  const { id, secret } = creds()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: id,
      client_secret: secret,
      grant_type: 'refresh_token',
    }),
  })
  const json = (await res.json()) as { access_token?: string; error?: string }
  if (!res.ok || !json.access_token) throw new Error(`accessToken: ${json.error ?? res.status}`)
  return json.access_token
}

const authHeader = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

// The backups folder id: reuse `known` if it still exists, else find by name, else
// create it. Returns the id to persist.
export async function ensureFolder(token: string, known: string | null): Promise<string> {
  if (known) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${known}?fields=id,trashed`, { headers: authHeader(token) })
    if (res.ok) {
      const f = (await res.json()) as { id: string; trashed?: boolean }
      if (!f.trashed) return f.id
    }
  }
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`, { headers: authHeader(token) })
  if (found.ok) {
    const list = (await found.json()) as { files?: { id: string }[] }
    if (list.files && list.files[0]) return list.files[0].id
  }
  const created = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  if (!created.ok) throw new Error(`ensureFolder create: ${created.status}`)
  return ((await created.json()) as { id: string }).id
}

// One snapshot file on Drive.
export type DriveFile = { id: string; name: string; size: number; createdTime: string }

// Snapshots in the folder, newest first.
export async function listSnapshots(token: string, folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&spaces=drive&pageSize=100`,
    { headers: authHeader(token) },
  )
  if (!res.ok) throw new Error(`listSnapshots: ${res.status}`)
  const json = (await res.json()) as { files?: { id: string; name: string; size?: string; createdTime: string }[] }
  return (json.files ?? []).map((f) => ({ id: f.id, name: f.name, size: Number(f.size ?? 0), createdTime: f.createdTime }))
}

// Resumable upload of a file's bytes into the folder. Resumable avoids building a
// multipart body and streams in one PUT (snapshots are tens of MB).
export async function uploadSnapshot(token: string, folderId: string, name: string, body: Buffer): Promise<void> {
  const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [folderId] }),
  })
  if (!init.ok) throw new Error(`uploadSnapshot init: ${init.status}`)
  const uploadUrl = init.headers.get('location')
  if (!uploadUrl) throw new Error('uploadSnapshot: no resumable session URL')
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/gzip', 'Content-Length': String(body.length) },
    body: new Uint8Array(body),
  })
  if (!put.ok) throw new Error(`uploadSnapshot put: ${put.status}`)
}

export async function deleteSnapshot(token: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE', headers: authHeader(token) })
  if (!res.ok && res.status !== 404) throw new Error(`deleteSnapshot: ${res.status}`)
}

export async function downloadSnapshot(token: string, fileId: string): Promise<Buffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: authHeader(token) })
  if (!res.ok) throw new Error(`downloadSnapshot: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
