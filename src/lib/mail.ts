// SMTP mail (Nodemailer). Config lives on the `integration_keys` row (server-only
// secrets, like the Turnstile/Cloudflare keys) — NEVER in settings.data / the client
// payload. Env vars of the same name are a fallback. No-lock-in: the owner points this
// at their own SMTP server; nothing proprietary. SERVER-ONLY — never import client-side.

import nodemailer from 'nodemailer'
import { db, DB_TAG } from '@/lib/db'
import { revalidateTag } from 'next/cache'

export type SmtpConfig = {
  host: string
  port: number
  user: string
  pass: string
  from: string // From: address (e.g. "Blog <hi@example.com>")
  secure: boolean // true = implicit TLS (465); false = STARTTLS (587)
}

type Row = {
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_pass: string | null
  smtp_from: string | null
  smtp_secure: boolean | null
}

const env = (k: string) => process.env[k] ?? ''

// Resolve the SMTP config: stored values win, else same-named env vars.
export async function getSmtpConfig(): Promise<SmtpConfig> {
  let row: Row | null = null
  try {
    const { data } = await db()
      .from('integration_keys')
      .select('smtp_host,smtp_port,smtp_user,smtp_pass,smtp_from,smtp_secure')
      .eq('id', 1)
      .maybeSingle()
    row = (data as Row) ?? null
  } catch (error) {
    console.error(`[ERROR] mail.getSmtpConfig: ${(error as Error).message}`)
  }
  const port = row?.smtp_port ?? (Number(env('SMTP_PORT')) || 587)
  return {
    host: row?.smtp_host || env('SMTP_HOST'),
    port,
    user: row?.smtp_user || env('SMTP_USER'),
    pass: row?.smtp_pass || env('SMTP_PASS'),
    from: row?.smtp_from || env('SMTP_FROM'),
    secure: row?.smtp_secure ?? (port === 465),
  }
}

// Configured enough to send: a host and a From address.
export function isMailConfigured(cfg: SmtpConfig): boolean {
  return !!(cfg.host && cfg.from)
}

// Client-safe status (no secrets): whether mail can send + the From address.
export async function getMailStatus(): Promise<{ configured: boolean; from: string }> {
  const cfg = await getSmtpConfig()
  return { configured: isMailConfigured(cfg), from: cfg.from }
}

// Save the SMTP config on integration_keys. `undefined` leaves a field untouched;
// '' clears a string field (back to the env fallback). Never busts the public cache
// via anything but the shared DB tag.
export async function saveSmtpConfig(input: Partial<SmtpConfig>): Promise<void> {
  const patch: Record<string, string | number | boolean | null> = {}
  if (input.host !== undefined) patch.smtp_host = input.host.trim() || null
  if (input.user !== undefined) patch.smtp_user = input.user.trim() || null
  if (input.pass !== undefined) patch.smtp_pass = input.pass.trim() || null
  if (input.from !== undefined) patch.smtp_from = input.from.trim() || null
  if (input.port !== undefined) patch.smtp_port = input.port || null
  if (input.secure !== undefined) patch.smtp_secure = input.secure
  await db().from('integration_keys').upsert({ ...patch, id: 1 })
  revalidateTag(DB_TAG, 'max')
}

// Send one email. Returns { sent } — degrades gracefully (never throws) when SMTP is
// unconfigured or the send fails, so a caller (subscribe/broadcast) can decide what to
// tell the user without a 500.
export async function sendMail(msg: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<{ sent: boolean; error?: string }> {
  const cfg = await getSmtpConfig()
  if (!isMailConfigured(cfg)) return { sent: false, error: 'smtp_not_configured' }
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    })
    await transport.sendMail({
      from: cfg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text || msg.html.replace(/<[^>]+>/g, ''),
    })
    return { sent: true }
  } catch (error) {
    console.error(`[ERROR] mail.sendMail: ${(error as Error).message}`)
    return { sent: false, error: (error as Error).message }
  }
}
