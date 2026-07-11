'use client'

// Backup card (Advanced settings): connect Google Drive, toggle automatic full
// snapshots (interval + retention flow through the settings form), and a self-
// contained panel to back up now, list / delete / restore snapshots. The Drive
// connection + snapshot list have their own API (/api/backup) — the refresh token
// never reaches the client — so this part owns its state like McpFields.
import { useCallback, useEffect, useState } from 'react'
import type { ApiResponse, BackupSettings } from '@/types'
import type { BackupStatus } from '@/lib/backup-state'
import type { DriveFile } from '@/lib/gdrive'
import { Button } from '@/components/ui/Button'
import { ToggleRow } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { formatDateTimeShort } from '@/lib/utils'
import { useAdminT } from './I18nProvider'

const INTERVALS = [1, 2, 3, 4, 7, 14, 30]
const KEEPS = [1, 2, 3, 4, 5, 7, 10]

function fmtSize(bytes: number): string {
  if (!bytes) return '—'
  const mb = bytes / 1_048_576
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

type BackupData = { status: BackupStatus; snapshots: DriveFile[] }

export function BackupFields({ backups, onChange }: { backups: BackupSettings; onChange: (b: BackupSettings) => void }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [data, setData] = useState<BackupData | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/backup')
      const json = (await res.json()) as ApiResponse<BackupData>
      if (json.success && json.data) setData(json.data)
    } catch {
      /* non-fatal: the card still shows the toggle */
    }
  }, [])

  // Initial load — inline fetch chain (setState inside the .then, not the body).
  useEffect(() => {
    fetch('/api/backup')
      .then((r) => r.json() as Promise<ApiResponse<BackupData>>)
      .then((j) => {
        if (j.success && j.data) setData(j.data)
      })
      .catch(() => {})
  }, [])

  // Re-sync when the owner returns to the tab — connecting Drive happens via a
  // full-page OAuth round-trip, so refetch on focus to reflect it without a manual
  // reload (listeners only — no setState in the body).
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refresh])

  // Show a toast for the Drive connect redirect result (?backup=connected|error).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('backup')
    if (p === 'connected') notify(t.backupConnected)
    else if (p === 'error') notify(t.backupToastFail, 'error')
    if (p) window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  }, [notify, t])

  async function act(fn: () => Promise<Response>, okMsg: string): Promise<void> {
    setBusy(true)
    try {
      const res = await fn()
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      notify(okMsg)
      await refresh()
    } catch {
      notify(t.backupToastFail, 'error')
    } finally {
      setBusy(false)
    }
  }

  const status = data?.status
  const snapshots = data?.snapshots ?? []

  return (
    <div className="space-y-5">
      {/* Drive connection */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t.backupTitle}</h3>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            {status?.connected ? t.backupConnected : t.backupHint}
          </p>
        </div>
        {status?.connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(t.backupDisconnectConfirm)) act(() => fetch('/api/backup/disconnect', { method: 'POST' }), t.backupToastOk)
            }}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            {t.backupDisconnect}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { window.location.href = '/api/backup/connect' }}
            className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {t.backupConnect}
          </button>
        )}
      </div>

      {/* Schedule (flows through the settings save) — only meaningful once connected */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <ToggleRow
          label={t.backupAuto}
          desc={t.backupAutoDesc}
          checked={backups.enabled}
          onChange={(enabled) => onChange({ ...backups, enabled })}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-neutral-200 p-4 dark:border-neutral-800">
          <label className="block text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">{t.backupIntervalLabel}</span>
            <select
              value={backups.intervalDays}
              onChange={(e) => onChange({ ...backups, intervalDays: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
            >
              {INTERVALS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">{t.backupKeepLabel}</span>
            <select
              value={backups.keep}
              onChange={(e) => onChange({ ...backups, keep: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
            >
              {KEEPS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Snapshots + manual run */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {t.backupLastRun}: {status?.lastRunAt ? formatDateTimeShort(status.lastRunAt) : t.backupNever}
            {status?.lastStatus === 'error' && <span className="ml-1 font-medium text-neutral-900 dark:text-white">({t.backupToastFail})</span>}
          </p>
          <Button type="button" disabled={busy || !status?.connected} onClick={() => act(() => fetch('/api/backup', { method: 'POST' }), t.backupToastOk)}>
            {t.backupNow}
          </Button>
        </div>

        {snapshots.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">{t.backupNone}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.backupColDate}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">{t.backupColSize}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTimeShort(s.createdTime)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-neutral-500 sm:table-cell dark:text-neutral-400">{fmtSize(s.size)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(t.backupRestoreConfirm)) act(() => fetch('/api/backup/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: s.id }) }), t.backupToastOk)
                        }}
                        className="rounded-lg px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        {t.backupRestore}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(t.backupDeleteConfirm)) act(() => fetch(`/api/backup?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' }), t.backupToastOk)
                        }}
                        className="rounded-lg px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        {t.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
