// The backup panel, and what replaced the one the frozen tree had.
//
// Quire 2.0 does not back up to Google Drive. Continuous replication is litestream's job,
// running beside the process and replicating the SQLite file to R2 — a decision on the
// record (parity exception 1) that deleted ~730 lines of OAuth, token refresh and folder
// bookkeeping. So there is nothing to "connect" here and no Drive file list to show, and a
// panel that still offered them would be offering something that cannot happen.
//
// What the exception promised in exchange, and what this is, is a manual archive: one file
// holding the database, the uploads and the settings, that the owner can download and keep
// somewhere they control.

import { useState } from 'react'
import { Button } from '@/admin/ui/Button'
import { ToggleField } from '@/admin/ui/Switch'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import type { BackupSettings } from '@/types'

export function ExportFields({
  backups,
  onChange,
}: {
  backups: BackupSettings
  onChange: (b: BackupSettings) => void
}) {
  const t = useAdminT()
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const res = await fetch('/api/backup/export')
      if (!res.ok) throw new Error(String(res.status))
      // A blob, not a plain link: the route is owner-gated, so it has to be fetched with
      // the session's cookies and handed to the browser as a download afterwards.
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1]
        ?? 'quire-archive.tar.gz'
      a.click()
      URL.revokeObjectURL(url)
      notify(t.backupToastOk)
    } catch {
      notify(t.backupToastFail, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.exportHint}</p>

      <Button onClick={download} disabled={busy}>
        {busy ? t.exportBusy : t.exportNow}
      </Button>

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <ToggleField
          label={t.backupAuto}
          checked={backups.enabled}
          onChange={(enabled) => onChange({ ...backups, enabled })}
        />
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">{t.exportReplicationNote}</p>
      </div>
    </div>
  )
}
